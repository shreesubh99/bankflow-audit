from typing import List, Dict, Any, Tuple

class DuplicateDetector:
    """
    Detects potential duplicate transactions using:
    1. Exact Transaction ID / UTR match
    2. Exact (Date + Amount + Party) match
    3. Reference number collisions
    Does NOT delete records; marks them as POSSIBLE DUPLICATE for audit resolution.
    """
    @staticmethod
    def detect(transactions: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        seen_refs = {}
        seen_triplets = {}
        flags = []

        for t in transactions:
            t_id = t["id"]
            ref = t.get("bank_ref_utr") or t.get("txn_reference")
            date_val = t.get("txn_date")
            amt = t.get("amount", 0.0)
            party = (t.get("party_name") or "").strip().upper()

            is_dup = False
            dup_reason = ""
            orig_id = None

            # 1. Match by reference / UTR (if non-trivial)
            if ref and len(str(ref)) > 2 and str(ref) not in ('DONE', 'UPI', 'NEFT', 'None'):
                if ref in seen_refs:
                    is_dup = True
                    orig_id = seen_refs[ref]
                    dup_reason = f"Duplicate UTR/Reference '{ref}' with transaction {orig_id[:8]}"
                else:
                    seen_refs[ref] = t_id

            # 2. Match by Date + Amount + Party
            if not is_dup and party and amt > 0:
                key = (date_val, amt, party)
                if key in seen_triplets:
                    is_dup = True
                    orig_id = seen_triplets[key]
                    dup_reason = f"Duplicate Date ({date_val}), Amount (₹{amt}), and Party ('{party}') with transaction {orig_id[:8]}"
                else:
                    seen_triplets[key] = t_id

            if is_dup:
                t["is_duplicate"] = True
                t["duplicate_of_id"] = orig_id
                t["audit_flag"] = "Possible Duplicate"
                flags.append({
                    "txn_id": t_id,
                    "sheet_name": t.get("source_sheet"),
                    "flag_type": "Duplicate Transaction",
                    "severity": "HIGH",
                    "description": dup_reason,
                    "status": "OPEN"
                })

        return transactions, flags
