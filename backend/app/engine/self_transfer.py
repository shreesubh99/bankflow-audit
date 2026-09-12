import re
from typing import List, Dict, Any

class SelfTransferEngine:
    KEYWORDS = [
        r'\bSELF\b', r'\bSELF\s*TR\b', r'\bSELF\s*TRANSFER\b',
        r'\bOWN\s*ACCOUNT\b', r'\bINTERNAL\s*TRANSFER\b',
        r'\bSHREE\s*SHUBH\b', r'\bSHREE\s*SUBH\b'
    ]
    PATTERN = re.compile('|'.join(KEYWORDS), re.IGNORECASE)

    @classmethod
    def evaluate(cls, party_name: str = "", description: str = "") -> bool:
        text = f"{party_name or ''} {description or ''}"
        return bool(cls.PATTERN.search(text))

    @classmethod
    def apply(cls, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for t in transactions:
            if cls.evaluate(t.get("party_name", ""), t.get("description", "")):
                if t.get("source_table") == "ONLINE_PAYMENT" or t.get("direction") == "OUT":
                    t["direction"] = "OUT"
                    t["transaction_nature"] = "PERSONAL EXPENSE"
                    t["category"] = "PERSONAL EXPENSES"
                    t["expense_sector"] = "PERSONAL"
                    t["audit_flag"] = "Personal Expense"
                elif t.get("source_table") == "BANK_DEPOSIT":
                    t["direction"] = "IN"
                    t["transaction_nature"] = "BANK DEPOSIT"
                    t["category"] = "OWNER / SELF DEPOSIT"
                    if not t.get("audit_flag"):
                        t["audit_flag"] = "Possible Self Transfer"
                else:
                    t["direction"] = "INTERNAL"
                    t["transaction_nature"] = "SELF TRANSFER"
                    t["category"] = "INTERNAL MOVEMENT"
                    if not t.get("audit_flag"):
                        t["audit_flag"] = "Possible Self Transfer"
                t["confidence_score"] = max(t.get("confidence_score", 0.0), 95.0)
        return transactions
