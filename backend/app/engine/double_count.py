import uuid
from typing import List, Dict, Any, Tuple

class DoubleCountEngine:
    """
    Identifies relationships between UPI QR customer receipts and UPI bank settlements.
    When ₹10,000 is collected via UPI QR and subsequently ₹10,000 enters the bank as
    a UPI Settlement, the bank entry must be treated as an INTERNAL/SETTLEMENT movement
    rather than new revenue.
    """
    @staticmethod
    def process_settlements(transactions: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        links = []
        # Group UPI collections by date
        upi_by_date = {}
        for t in transactions:
            if t["source_table"] == "UPI_QR" and t["direction"] == "IN":
                d = t["txn_date"]
                upi_by_date.setdefault(d, []).append(t)

        # Match bank settlements with UPI collections
        for t in transactions:
            if t["transaction_nature"] == "UPI SETTLEMENT":
                t["direction"] = "INTERNAL"
                settlement_group = f"SETTLE-{str(uuid.uuid4())[:8]}"
                t["settlement_group_id"] = settlement_group

                # Look for matching UPI collections on previous day (T-1) or same day (T)
                d = t["txn_date"]
                candidates = upi_by_date.get(d, [])
                
                # Check if settle date was specified
                if t.get("value_date") and t["value_date"] in upi_by_date:
                    candidates = upi_by_date[t["value_date"]]

                # Link corresponding UPI transactions
                for upi_tx in candidates:
                    if not upi_tx.get("settlement_group_id"):
                        upi_tx["settlement_group_id"] = settlement_group
                        links.append({
                            "source_txn_id": upi_tx["id"],
                            "target_txn_id": t["id"],
                            "link_type": "UPI_TO_SETTLEMENT",
                            "notes": f"Linked UPI QR collection on {upi_tx['txn_date']} to settlement on {t['txn_date']}"
                        })

        return transactions, links
