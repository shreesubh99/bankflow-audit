from typing import List, Dict, Any, Optional

class AuditEngine:
    """
    Computes daily financial audit rollups:
    - MONEY RECEIVED (Bank Deposits + UPI Collections + Other Receipts)
    - MONEY MOVED INTERNALLY (UPI Settlements + Self Transfers)
    - MONEY SPENT (Online Payments + Expenses + Card Payments)
    - NET OPERATING MOVEMENT = MONEY RECEIVED - MONEY SPENT
    Also gathers and computes audit exception flags.
    """
    @staticmethod
    def compute_daily_summaries(
        transactions: List[Dict[str, Any]],
        import_id: int,
        initial_opening_balance: float = 0.0,
        initial_prev_upi_qr: float = 0.0,
        initial_prev_qr_amounts: Optional[List[float]] = None
    ) -> List[Dict[str, Any]]:
        # Group by txn_date
        by_date: Dict[str, List[Dict[str, Any]]] = {}
        for t in transactions:
            d = t.get("txn_date")
            if d:
                by_date.setdefault(d, []).append(t)

        summaries = []
        running_bank_balance = round(initial_opening_balance, 2)
        prev_upi_qr = round(initial_prev_upi_qr, 2)
        prev_qr_amounts = list(initial_prev_qr_amounts or [])

        for d, txns in sorted(by_date.items()):
            customer_receipts = 0.0
            table1_sum = 0.0
            cash_deposits = 0.0
            bank_transfer_deposits = 0.0
            upi_qr = 0.0
            upi_settlements = 0.0
            actual_expenses = 0.0
            business_expenses = 0.0
            personal_expenses = 0.0
            internal_transfers = 0.0
            bank_credits = 0.0
            bank_debits = 0.0
            unclassified = 0
            flags_count = 0

            for t in txns:
                amt = float(t.get("amount", 0.0))
                nature = t.get("transaction_nature", "")
                direction = t.get("direction", "")
                source_table = t.get("source_table", "")
                p_name = t.get("party_name", "") or ""
                desc = t.get("description", "") or ""
                full_text = f"{p_name} {desc}".upper()

                if t.get("audit_flag"):
                    flags_count += 1
                if t.get("status") == "UNKNOWN" or not (t.get("source_sector") or t.get("expense_sector") or t.get("category")):
                    unclassified += 1

                # Table 1: All entries in Table 1 (BANK_DEPOSIT)
                if source_table == "BANK_DEPOSIT":
                    table1_sum += amt
                    if any(k in full_text for k in ["CASH", "CARDLESS", "CARDLESH", "CDM", "CURRENCY"]):
                        cash_deposits += amt
                    elif "UPI SETTLEMENT" in full_text or "UPI SETTELMENT" in full_text:
                        upi_settlements += amt
                        internal_transfers += amt
                    else:
                        bank_transfer_deposits += amt

                # Table 3: All payments in Table 3 (ONLINE_PAYMENT)
                elif source_table == "ONLINE_PAYMENT":
                    bank_debits += amt
                    actual_expenses += amt
                    is_personal = (
                        t.get("category") == "PERSONAL EXPENSES"
                        or nature == "PERSONAL EXPENSE"
                        or any(k in full_text for k in ["SELF", "SELF TR", "OWN ACCOUNT", "SHUBH"])
                    )
                    if is_personal:
                        personal_expenses += amt
                    else:
                        business_expenses += amt
                    if direction == "INTERNAL":
                        internal_transfers += amt

                # Table 2: UPI QR Collections in Table 2 (UPI_QR)
                elif source_table == "UPI_QR":
                    if direction == "IN":
                        upi_qr += amt
                    elif direction == "INTERNAL":
                        internal_transfers += amt

                if direction == "IN" or source_table == "BANK_DEPOSIT":
                    customer_receipts += amt

            net_op = customer_receipts - business_expenses
            # Direct Bank Deposits = Full Table 1 Sum (Cash + Bank Transfers + All Table 1 entries)
            direct_bank_deposits = round(table1_sum, 2)

            # Total Bank Deposits (Inflows) = Table 1 Sum + Table 2 Sum (UPI QR)
            total_bank_deposits = round(table1_sum + upi_qr, 2)
            gross_turnover = total_bank_deposits
            bank_credits = total_bank_deposits

            # Double count mitigation:
            # If today has Table 1 UPI Settlements AND previous day had Table 2 QR collections,
            # calculate the matched settlement amount to deduct from closing balance
            matched_settlement = 0.0
            if upi_settlements > 0 and prev_upi_qr > 0:
                if abs(upi_settlements - prev_upi_qr) < 0.01:
                    matched_settlement = upi_settlements
                else:
                    today_upi_settle_txns = [
                        float(t.get("amount", 0.0)) for t in txns
                        if t.get("source_table") == "BANK_DEPOSIT"
                        and float(t.get("amount", 0.0)) > 0
                        and any(k in f"{t.get('party_name', '')} {t.get('description', '')}".upper() for k in ["UPI SETTLEMENT", "UPI SETTELMENT"])
                    ]
                    temp_prev_amounts = list(prev_qr_amounts)
                    for amt_val in today_upi_settle_txns:
                        if amt_val in temp_prev_amounts:
                            matched_settlement += amt_val
                            temp_prev_amounts.remove(amt_val)
                    if matched_settlement == 0.0 and 0 < (prev_upi_qr - upi_settlements) < (prev_upi_qr * 0.025):
                        matched_settlement = upi_settlements
                    elif matched_settlement == 0.0 and upi_settlements <= prev_upi_qr:
                        matched_settlement = upi_settlements
                    elif matched_settlement == 0.0 and upi_settlements > prev_upi_qr:
                        matched_settlement = prev_upi_qr

            # Bank Account Balance Flow for this date:
            # Deduct matched UPI settlements from closing balance to prevent double counting!
            day_opening_bal = running_bank_balance
            day_closing_bal = round(day_opening_bal + bank_credits - bank_debits - matched_settlement, 2)
            running_bank_balance = day_closing_bal

            # Update prev_upi_qr for next day's matching
            prev_upi_qr = upi_qr
            prev_qr_amounts = [float(t.get("amount", 0.0)) for t in txns if t.get("source_table") == "UPI_QR" and t.get("direction") == "IN"]

            summaries.append({
                "import_id": import_id,
                "summary_date": d,
                "gross_turnover": round(gross_turnover, 2),
                "total_customer_receipts": round(customer_receipts, 2),
                "bank_deposits": total_bank_deposits, # Table 1 + Table 2
                "direct_bank_deposits": round(direct_bank_deposits, 2), # Full Table 1 Sum
                "cash_deposits": round(cash_deposits, 2),
                "bank_transfer_deposits": round(bank_transfer_deposits, 2),
                "upi_qr_collections": round(upi_qr, 2), # Table 2 Sum
                "upi_settlements": round(upi_settlements, 2),
                "actual_expenses": round(actual_expenses, 2),
                "business_expenses": round(business_expenses, 2),
                "personal_expenses": round(personal_expenses, 2),
                "internal_transfers": round(internal_transfers, 2),
                "net_operating_movement": round(net_op, 2),
                "opening_balance": round(day_opening_bal, 2),
                "bank_credits": round(bank_credits, 2),
                "bank_debits": round(bank_debits, 2),
                "matched_settlement_deducted": round(matched_settlement, 2),
                "closing_balance": round(day_closing_bal, 2),
                "txn_count": len(txns),
                "unclassified_count": unclassified,
                "audit_flag_count": flags_count
            })

        return summaries

    @staticmethod
    def generate_all_audit_flags(
        transactions: List[Dict[str, Any]],
        reconciliations: List[Dict[str, Any]],
        import_id: int
    ) -> List[Dict[str, Any]]:
        flags = []

        # 1. Flags from transactions
        for t in transactions:
            t_id = t["id"]
            sname = t.get("source_sheet")
            nature = t.get("transaction_nature")
            amt = t.get("amount", 0.0)

            # Date conflict (e.g. txn date differs from sheet date)
            # In sheet name '01-SEP', txn_date might be '2026-08-31'
            if t.get("value_date") and t.get("value_date") != t.get("txn_date"):
                # Value date / settlement date variance
                pass

            if amt == 0.0:
                flags.append({
                    "import_id": import_id,
                    "txn_id": t_id,
                    "sheet_name": sname,
                    "flag_type": "Missing Amount",
                    "severity": "LOW",
                    "description": f"Transaction in sheet '{sname}' row {t.get('original_row')} has 0 or empty amount",
                    "status": "OPEN"
                })

            if not t.get("txn_date"):
                flags.append({
                    "import_id": import_id,
                    "txn_id": t_id,
                    "sheet_name": sname,
                    "flag_type": "Missing Date",
                    "severity": "HIGH",
                    "description": f"Transaction in sheet '{sname}' row {t.get('original_row')} has missing date",
                    "status": "OPEN"
                })

            if nature in ("SELF TRANSFER", "PERSONAL EXPENSE"):
                flags.append({
                    "import_id": import_id,
                    "txn_id": t_id,
                    "sheet_name": sname,
                    "flag_type": "Personal Expense" if nature == "PERSONAL EXPENSE" else "Possible Self Transfer",
                    "severity": "INFO",
                    "description": f"Personal expense / self transfer of ₹{amt:,.2f} detected for '{t.get('party_name')}'",
                    "status": "OPEN"
                })

            elif nature == "UPI SETTLEMENT":
                flags.append({
                    "import_id": import_id,
                    "txn_id": t_id,
                    "sheet_name": sname,
                    "flag_type": "Possible UPI Settlement",
                    "severity": "INFO",
                    "description": f"UPI Settlement entry of ₹{amt:,.2f} on {t.get('txn_date')}",
                    "status": "OPEN"
                })

            if t.get("status") == "UNKNOWN":
                flags.append({
                    "import_id": import_id,
                    "txn_id": t_id,
                    "sheet_name": sname,
                    "flag_type": "Unclassified Transaction",
                    "severity": "LOW",
                    "description": f"Unclassified transaction ₹{amt:,.2f} for '{t.get('party_name') or 'N/A'}'",
                    "status": "OPEN"
                })

        # 2. Source total mismatches from reconciliation
        for r in reconciliations:
            if r.get("status") == "MISMATCH":
                flags.append({
                    "import_id": import_id,
                    "txn_id": None,
                    "sheet_name": r.get("sheet_name"),
                    "flag_type": "Source Total Mismatch",
                    "severity": "HIGH",
                    "description": f"Sheet '{r.get('sheet_name')}' section '{r.get('section_name')}': reported ₹{r.get('reported_total', 0):,.2f} vs parsed ₹{r.get('parsed_total', 0):,.2f} (Diff: ₹{r.get('difference', 0):,.2f})",
                    "status": "OPEN"
                })

        return flags
