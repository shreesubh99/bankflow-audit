import uuid
from typing import List, Dict, Any, Optional, Tuple

class FundTrackerEngine:
    """
    Manages Source-to-Expense fund ledger, many-to-many allocations,
    forward trace trees, reverse lookups, and the cross-tab sector flow matrix.
    """
    @staticmethod
    def generate_funds_from_receipts(
        transactions: List[Dict[str, Any]], 
        import_id: Optional[int] = None,
        initial_opening_balance: float = 0.0,
        opening_date: Optional[str] = None,
        start_fund_counter: int = 1
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        funds = []
        fund_counter = start_fund_counter
        prefix = f"FUND-{import_id}-" if import_id else "FUND-"
        id_prefix = f"F_{import_id}_" if import_id else "F_"

        # If opening balance exists, seed an opening balance fund on the earliest date
        if initial_opening_balance > 0 and opening_date:
            fund_code = f"{prefix}{fund_counter:06d}"
            fund_id = f"{id_prefix}{fund_counter:06d}"
            funds.append({
                "id": fund_id,
                "fund_code": fund_code,
                "source_date": opening_date,
                "source_sector": "OPENING BALANCE",
                "source_txn_id": None,
                "original_amount": round(initial_opening_balance, 2),
                "allocated_amount": 0.0,
                "spent_amount": 0.0,
                "remaining_amount": round(initial_opening_balance, 2),
                "status": "OPEN",
                "notes": f"Bank Opening Balance on {opening_date}"
            })
            fund_counter += 1

        # Identify qualifying receipts: incoming customer receipts or bank deposits with a source sector
        for t in transactions:
            if t["direction"] == "IN" and t.get("amount", 0.0) > 0:
                sector = t.get("source_sector") or "GENERAL POOL"
                fund_code = f"{prefix}{fund_counter:06d}"
                fund_id = f"{id_prefix}{fund_counter:06d}"
                amt = t["amount"]

                fund_obj = {
                    "id": fund_id,
                    "fund_code": fund_code,
                    "source_date": t["txn_date"],
                    "source_sector": sector,
                    "source_txn_id": t["id"],
                    "original_amount": amt,
                    "allocated_amount": 0.0,
                    "spent_amount": 0.0,
                    "remaining_amount": amt,
                    "status": "OPEN",
                    "notes": f"Created from {sector} receipt on {t['txn_date']} (Ref: {t.get('txn_id_extracted') or 'N/A'})"
                }
                funds.append(fund_obj)
                t["fund_id"] = fund_id
                fund_counter += 1

        return funds, transactions

    @staticmethod
    def auto_allocate_fifo(funds: List[Dict[str, Any]], expenses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Allocates expenses to open funds using FIFO matching by sector (or general pool).
        CRITICAL ACCOUNTING CAUSALITY:
        An expense on date D can ONLY be funded by funds received ON OR BEFORE date D:
            fund["source_date"] <= exp["txn_date"]
        Money received in the future (e.g. 04-Sep) can NEVER fund expenses from the past (e.g. 26-Aug)!
        """
        allocations = []
        # Sort funds chronologically
        sorted_funds = sorted(funds, key=lambda x: x["source_date"])
        
        for exp in sorted(expenses, key=lambda x: x["txn_date"]):
            exp_amt = exp.get("amount", 0.0)
            if exp_amt <= 0 or exp.get("direction") != "OUT":
                continue

            needed = exp_amt
            exp_sec = exp.get("expense_sector")
            exp_date = exp.get("txn_date")

            # 1. Matching Priority:
            # - Exact matching sector first
            # - OPENING BALANCE / GENERAL POOL second
            # - Other open sectors third
            def sort_key(f):
                if exp_sec and f.get("source_sector") == exp_sec:
                    sec_prio = 0
                elif f.get("source_sector") in ("OPENING BALANCE", "GENERAL POOL"):
                    sec_prio = 1
                else:
                    sec_prio = 2
                return (sec_prio, f["source_date"])

            # STRICT CHRONOLOGICAL CAUSALITY: Only funds received on or before expense date!
            eligible_funds = [
                f for f in sorted_funds 
                if f["remaining_amount"] > 0 and (not exp_date or not f.get("source_date") or f["source_date"] <= exp_date)
            ]
            eligible_funds.sort(key=sort_key)

            for f in eligible_funds:
                if needed <= 0.001:
                    break
                
                avail = f["remaining_amount"]
                alloc_amt = min(needed, avail)
                alloc_amt = round(alloc_amt, 2)

                f["allocated_amount"] = round(f["allocated_amount"] + alloc_amt, 2)
                f["spent_amount"] = round(f["spent_amount"] + alloc_amt, 2)
                f["remaining_amount"] = round(f["original_amount"] - f["spent_amount"], 2)

                if f["remaining_amount"] <= 0.01:
                    f["status"] = "FULLY USED"
                else:
                    f["status"] = "PARTIALLY USED"

                allocations.append({
                    "fund_id": f["id"],
                    "expense_txn_id": exp["id"],
                    "amount_allocated": alloc_amt,
                    "allocation_date": exp["txn_date"],
                    "allocation_method": "FIFO",
                    "notes": f"FIFO allocation of ₹{alloc_amt} to {exp.get('party_name') or 'Expense'} ({exp_sec or 'General'})"
                })

                needed = round(needed - alloc_amt, 2)

        return allocations

    @staticmethod
    def build_fund_trace_tree(fund: Dict[str, Any], allocations: List[Dict[str, Any]], expenses_map: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds visual hierarchical tree:
        Source Sector -> Fund Node -> [Expense Node 1, Expense Node 2, ..., Remaining Balance]
        """
        fund_allocs = [a for a in allocations if a["fund_id"] == fund["id"]]

        expense_children = []
        for a in fund_allocs:
            exp_id = a["expense_txn_id"]
            exp_tx = expenses_map.get(exp_id, {})
            expense_children.append({
                "id": f"alloc_{a.get('id', uuid.uuid4())}",
                "name": f"{exp_tx.get('party_name') or 'Expense'} ({exp_tx.get('expense_sector') or 'General'})",
                "type": "expense",
                "amount": a["amount_allocated"],
                "date": a["allocation_date"],
                "details": {
                    "txn_id": exp_id,
                    "sector": exp_tx.get("expense_sector"),
                    "category": exp_tx.get("category"),
                    "reference": exp_tx.get("txn_reference")
                },
                "children": []
            })

        # Add remaining node
        rem_node = {
            "id": f"rem_{fund['id']}",
            "name": "Remaining Available Balance",
            "type": "remaining",
            "amount": fund["remaining_amount"],
            "date": fund["source_date"],
            "details": {
                "status": fund["status"]
            },
            "children": []
        }
        all_children = expense_children + [rem_node]

        fund_node = {
            "id": fund["id"],
            "name": f"{fund['fund_code']} (₹{fund['original_amount']:,.2f})",
            "type": "fund",
            "amount": fund["original_amount"],
            "date": fund["source_date"],
            "details": {
                "sector": fund["source_sector"],
                "status": fund["status"],
                "spent": fund["spent_amount"],
                "remaining": fund["remaining_amount"]
            },
            "children": all_children
        }

        root = {
            "id": f"sec_{fund['source_sector']}",
            "name": f"Source: {fund['source_sector']}",
            "type": "sector",
            "amount": fund["original_amount"],
            "date": fund["source_date"],
            "details": {},
            "children": [fund_node]
        }

        return root

    @staticmethod
    def build_reverse_trace(expense_txn: Dict[str, Any], allocations: List[Dict[str, Any]], funds_map: Dict[str, Any]) -> Dict[str, Any]:
        """
        Reverse trace: Expense -> Funded by [Source Fund A (₹X), Source Fund B (₹Y)]
        """
        exp_id = expense_txn["id"]
        exp_allocs = [a for a in allocations if a["expense_txn_id"] == exp_id]

        sources = []
        for a in exp_allocs:
            f = funds_map.get(a["fund_id"])
            if f:
                sources.append({
                    "fund_id": f["id"],
                    "fund_code": f["fund_code"],
                    "source_sector": f["source_sector"],
                    "source_date": f["source_date"],
                    "amount_allocated": a["amount_allocated"],
                    "allocation_method": a["allocation_method"]
                })

        return {
            "expense_id": exp_id,
            "party_name": expense_txn.get("party_name"),
            "expense_sector": expense_txn.get("expense_sector"),
            "total_expense_amount": expense_txn.get("amount", 0.0),
            "date": expense_txn.get("txn_date"),
            "funding_sources": sources,
            "funded_amount": sum(s["amount_allocated"] for s in sources),
            "unfunded_amount": max(0.0, expense_txn.get("amount", 0.0) - sum(s["amount_allocated"] for s in sources))
        }

    @staticmethod
    def build_sector_flow_matrix(allocations: List[Dict[str, Any]], funds_map: Dict[str, Any], expenses_map: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds dynamic cross-tab matrix: Source Sector -> Expense Sector
        """
        matrix: Dict[str, Dict[str, float]] = {}
        source_sectors = set()
        expense_sectors = set()
        totals_by_source: Dict[str, float] = {}
        totals_by_expense: Dict[str, float] = {}

        for a in allocations:
            fund = funds_map.get(a["fund_id"])
            exp = expenses_map.get(a["expense_txn_id"])
            if not fund or not exp:
                continue

            src = fund.get("source_sector") or "OTHER"
            dest = exp.get("expense_sector") or "OTHER"
            amt = float(a.get("amount_allocated", 0.0))

            source_sectors.add(src)
            expense_sectors.add(dest)

            matrix.setdefault(src, {}).setdefault(dest, 0.0)
            matrix[src][dest] = round(matrix[src][dest] + amt, 2)

            totals_by_source[src] = round(totals_by_source.get(src, 0.0) + amt, 2)
            totals_by_expense[dest] = round(totals_by_expense.get(dest, 0.0) + amt, 2)

        sorted_sources = sorted(list(source_sectors))
        sorted_dests = sorted(list(expense_sectors))

        # Fill 0 for any missing matrix cells
        full_matrix = {}
        for s in sorted_sources:
            full_matrix[s] = {}
            for d in sorted_dests:
                full_matrix[s][d] = matrix.get(s, {}).get(d, 0.0)

        return {
            "source_sectors": sorted_sources,
            "expense_sectors": sorted_dests,
            "matrix": full_matrix,
            "totals_by_source": totals_by_source,
            "totals_by_expense": totals_by_expense
        }
