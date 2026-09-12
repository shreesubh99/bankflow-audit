import json
import re
from typing import Dict, Any, Tuple, Optional

SELF_KEYWORDS = ['SELF', 'SELF TR', 'SELF TRANSFER', 'OWN ACCOUNT', 'INTERNAL TRANSFER', 'SHREE SHUBH', 'SHREE SUBH']
SETTLEMENT_KEYWORDS = ['UPI SETTLEMENT', 'PAYZAPP SETTLEMENT', 'SMARTHUB SETTLEMENT', 'SETTLEMENT', 'EDC SETTLEMENT']
CARD_KEYWORDS = ['SBI CARDS', 'CREDIT CARD', 'CRED', 'HDFC CARD', 'CARD PAYMENT']
REVERSAL_KEYWORDS = ['RVSL', 'REVERSAL', 'REFUND', 'STUCK CASH']

class TransactionNormalizer:
    @staticmethod
    def normalize(row: Dict[str, Any], import_id: int) -> Dict[str, Any]:
        source_table = row.get("source_table", "UNKNOWN")
        party = (row.get("party_name") or "").strip()
        comment = (row.get("description") or "").strip()
        amount = float(row.get("amount", 0.0))
        full_text = f"{party} {comment}".upper()

        # Defaults based on source table
        direction = "IN"
        nature = "CUSTOMER RECEIPT"
        channel = row.get("payment_channel", "OTHER")
        txn_type = row.get("transaction_type", "TRANSFER")
        category = None
        source_sector = None
        expense_sector = None
        confidence = 80.0
        audit_flag = None

        # 1. Source Table: BANK_DEPOSIT
        if source_table == "BANK_DEPOSIT":
            direction = "IN"
            nature = "BANK DEPOSIT"
            channel = "BANK"
            confidence = 85.0

            # Check for UPI Settlement into Bank
            if any(k in full_text for k in SETTLEMENT_KEYWORDS):
                direction = "INTERNAL"
                nature = "UPI SETTLEMENT"
                confidence = 95.0
                audit_flag = "Possible UPI Settlement"
            # Check for Self Transfer into Bank
            elif any(k in full_text for k in SELF_KEYWORDS):
                direction = "IN"
                nature = "BANK DEPOSIT"
                category = "OWNER / SELF DEPOSIT"
                confidence = 92.0
                audit_flag = "Possible Self Transfer"
            # Check for Reversal / Stuck Cash
            elif any(k in full_text for k in REVERSAL_KEYWORDS):
                nature = "REVERSAL"
                confidence = 90.0
                audit_flag = "Reversal / Refund Entry"

        # 2. Source Table: UPI_QR
        elif source_table == "UPI_QR":
            channel = "UPI"
            confidence = 85.0
            
            # Check for Self Transfer inside UPI
            if any(k in full_text for k in SELF_KEYWORDS):
                direction = "INTERNAL"
                nature = "SELF TRANSFER"
                confidence = 92.0
                audit_flag = "Possible Self Transfer"
            else:
                direction = "IN"
                nature = "UPI QR COLLECTION"

        # 3. Source Table: ONLINE_PAYMENT
        elif source_table == "ONLINE_PAYMENT":
            direction = "OUT"
            nature = "EXPENSE"
            confidence = 85.0

            # Check for Self Transfer in Payment -> Personal Expense
            if any(k in full_text for k in SELF_KEYWORDS):
                direction = "OUT"
                nature = "PERSONAL EXPENSE"
                category = "PERSONAL EXPENSES"
                expense_sector = "PERSONAL"
                confidence = 95.0
                audit_flag = "Personal Expense"
            # Check for Card Payment
            elif any(k in full_text for k in CARD_KEYWORDS):
                nature = "CARD PAYMENT"
                category = "CREDIT CARD"
                expense_sector = "CARD"
                confidence = 95.0
            # Check for Refund
            elif any(k in full_text for k in REVERSAL_KEYWORDS):
                nature = "REFUND"
                confidence = 90.0
                audit_flag = "Refund / Reversal Payment"

        # Sector inference from party & comment
        inferred_sector = TransactionNormalizer._infer_sector(full_text)
        if inferred_sector:
            if direction == "IN":
                source_sector = inferred_sector
                confidence = min(confidence + 10.0, 99.0)
            elif direction == "OUT":
                expense_sector = inferred_sector
                confidence = min(confidence + 10.0, 99.0)
            if not category:
                category = inferred_sector

        # Amount validation
        if amount == 0.0:
            if not audit_flag:
                audit_flag = "Zero Amount Transaction"
            confidence = max(confidence - 20.0, 30.0)

        # Raw values JSON
        raw_json = json.dumps(row.get("raw_values", []), default=str)

        return {
            "id": row["id"],
            "import_id": import_id,
            "txn_id_extracted": row.get("txn_id_extracted"),
            "txn_date": row["txn_date"],
            "txn_time": row.get("txn_time"),
            "value_date": row.get("value_date"),
            "source_sheet": row["source_sheet"],
            "source_table": row["source_table"],
            "transaction_type": txn_type,
            "transaction_nature": nature,
            "payment_channel": channel,
            "party_name": party or None,
            "bank_ref_utr": row.get("bank_ref_utr"),
            "txn_reference": row.get("txn_reference"),
            "description": comment or None,
            "amount": amount,
            "fee_amount": row.get("fee_amount", 0.0),
            "direction": direction,
            "source_sector": source_sector,
            "expense_sector": expense_sector,
            "category": category,
            "status": "AUTO CLASSIFIED",
            "confidence_score": confidence,
            "audit_flag": audit_flag,
            "original_row": row["original_row"],
            "original_sheet": row["original_sheet"],
            "original_raw_data": raw_json
        }

    @staticmethod
    def _infer_sector(text: str) -> Optional[str]:
        # Priority sector keywords from real workbook
        if 'AKBAR' in text or 'AKB' in text:
            return 'AKBAR'
        if 'YTSK' in text:
            return 'YTSK'
        if 'COCKPIT' in text:
            return 'COCKPIT'
        if 'PASSPORT' in text:
            return 'PASSPORT'
        if 'HOTEL' in text:
            return 'HOTEL'
        if 'PURI' in text:
            return 'PURI'
        if 'ETIOS' in text or 'INNOVA' in text or 'VH' in text:
            return 'VEHICLE / CAB'
        if 'AIRPORT' in text or 'FLIGHT' in text:
            return 'FLIGHT'
        return None
