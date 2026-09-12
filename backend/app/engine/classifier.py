import re
from typing import List, Dict, Any, Optional

DEFAULT_RULES = [
    {"name": "Akbar Keyword", "pattern": r"\b(AKBAR|AKB)\b", "match_field": "all", "target_nature": None, "target_sector": "AKBAR", "target_category": "AKBAR", "confidence_score": 98.0, "priority": 1},
    {"name": "YTSK Keyword", "pattern": r"\b(YTSK|YTSK\s*1604)\b", "match_field": "all", "target_nature": None, "target_sector": "YTSK", "target_category": "YTSK TICKETING", "confidence_score": 98.0, "priority": 2},
    {"name": "Cockpit Payment", "pattern": r"\bCOCKPIT\b", "match_field": "all", "target_nature": None, "target_sector": "COCKPIT", "target_category": "COCKPIT FLIGHT", "confidence_score": 95.0, "priority": 3},
    {"name": "Passport Services", "pattern": r"\bPASSPORT\b", "match_field": "all", "target_nature": None, "target_sector": "PASSPORT", "target_category": "PASSPORT SECTOR", "confidence_score": 96.0, "priority": 4},
    {"name": "Hotel Booking", "pattern": r"\bHOTEL\b", "match_field": "all", "target_nature": None, "target_sector": "HOTEL", "target_category": "HOTEL ACCOMMODATION", "confidence_score": 95.0, "priority": 5},
    {"name": "Puri Tour Package", "pattern": r"\bPURI\b", "match_field": "all", "target_nature": None, "target_sector": "PURI", "target_category": "PURI PACKAGE", "confidence_score": 95.0, "priority": 6},
    {"name": "Credit Card / CRED", "pattern": r"\b(CRED|SBI\s*CARDS|CREDIT\s*CARD)\b", "match_field": "all", "target_nature": "CARD PAYMENT", "target_sector": "CARD", "target_category": "CARD PAYMENT", "confidence_score": 97.0, "priority": 7},
    {"name": "Personal Expense / Self Transfer", "pattern": r"\b(SELF|SELF\s*TR|SELF\s*TRANSFER|OWN\s*ACCOUNT)\b", "match_field": "all", "target_nature": "PERSONAL EXPENSE", "target_sector": "PERSONAL", "target_category": "PERSONAL EXPENSES", "confidence_score": 99.0, "priority": 8},
    {"name": "UPI Settlement Rule", "pattern": r"\b(UPI\s*SETTLEMENT|PAYZAPP\s*SETTLEMENT)\b", "match_field": "all", "target_nature": "UPI SETTLEMENT", "target_sector": None, "target_category": "SETTLEMENT", "confidence_score": 99.0, "priority": 9},
    {"name": "Vehicle & Cab", "pattern": r"\b(ETIOS|INNOVA|OIL|CAB|AIRPORT)\b", "match_field": "all", "target_nature": None, "target_sector": "TRANSPORT", "target_category": "VEHICLE & TRANSPORT", "confidence_score": 92.0, "priority": 10},
    {"name": "Refund / Reversal", "pattern": r"\b(RVSL|REFUND|REVERSAL)\b", "match_field": "all", "target_nature": "REFUND", "target_sector": None, "target_category": "REFUND/REVERSAL", "confidence_score": 94.0, "priority": 11}
]

class SmartClassifier:
    def __init__(self, custom_rules: Optional[List[Dict[str, Any]]] = None):
        rules = custom_rules if custom_rules is not None else DEFAULT_RULES
        self.rules = sorted(rules, key=lambda x: x.get("priority", 100))

    def classify_transaction(self, txn: Dict[str, Any]) -> Dict[str, Any]:
        party = txn.get("party_name") or ""
        comment = txn.get("description") or ""
        all_text = f"{party} {comment}".strip()

        for rule in self.rules:
            if not rule.get("is_active", True):
                continue

            pattern = rule["pattern"]
            field = rule.get("match_field", "all")

            target_text = all_text
            if field == "party_name":
                target_text = party
            elif field == "description":
                target_text = comment

            if re.search(pattern, target_text, re.IGNORECASE):
                # Apply rule targets
                target_nat = rule.get("target_nature")
                if target_nat in ("SELF TRANSFER", "PERSONAL EXPENSE"):
                    if txn.get("source_table") == "ONLINE_PAYMENT" or txn.get("direction") == "OUT":
                        txn["transaction_nature"] = "PERSONAL EXPENSE"
                        txn["direction"] = "OUT"
                        txn["category"] = "PERSONAL EXPENSES"
                        txn["expense_sector"] = "PERSONAL"
                    elif txn.get("source_table") == "BANK_DEPOSIT":
                        txn["transaction_nature"] = "BANK DEPOSIT"
                        txn["direction"] = "IN"
                        txn["category"] = "OWNER / SELF DEPOSIT"
                    else:
                        txn["transaction_nature"] = "SELF TRANSFER"
                        txn["direction"] = "INTERNAL"
                        txn["category"] = "INTERNAL MOVEMENT"
                elif target_nat == "UPI SETTLEMENT":
                    txn["transaction_nature"] = "UPI SETTLEMENT"
                    txn["direction"] = "INTERNAL"
                elif target_nat:
                    txn["transaction_nature"] = target_nat

                if rule.get("target_sector"):
                    if txn.get("direction") == "IN":
                        txn["source_sector"] = rule["target_sector"]
                    elif txn.get("direction") == "OUT":
                        txn["expense_sector"] = rule["target_sector"]
                if rule.get("target_category") and txn.get("category") is None:
                    txn["category"] = rule["target_category"]
                
                txn["confidence_score"] = float(rule.get("confidence_score", 90.0))
                txn["status"] = "AUTO CLASSIFIED"
                return txn

        # Default confidence if no rule matched
        if txn.get("source_sector") or txn.get("expense_sector") or txn.get("category"):
            txn["confidence_score"] = 75.0
        else:
            txn["confidence_score"] = 40.0
            txn["status"] = "UNKNOWN"
            if not txn.get("audit_flag"):
                txn["audit_flag"] = "Unclassified Transaction"

        return txn

    def classify_all(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [self.classify_transaction(t) for t in transactions]
