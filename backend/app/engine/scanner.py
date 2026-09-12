import os
import re
import hashlib
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, date
import openpyxl

MONTH_MAP = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
}

def compute_file_hash(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def extract_date_from_sheet_name(sheet_name: str, default_year: int = 2026) -> Optional[str]:
    name = sheet_name.strip().upper()
    
    # Pattern 1: 01-MAY or 2-MAY or 15-JUL or 30-AUG
    m = re.search(r'(\d{1,2})[-_\s/](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)', name)
    if m:
        day = int(m.group(1))
        month_str = m.group(2)
        month = MONTH_MAP[month_str]
        try:
            d = date(default_year, month, day)
            return d.strftime('%Y-%m-%d')
        except ValueError:
            pass

    # Pattern 2: MAY-01 or MAY 02
    m2 = re.search(r'(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-_\s/](\d{1,2})', name)
    if m2:
        month_str = m2.group(1)
        day = int(m2.group(2))
        month = MONTH_MAP[month_str]
        try:
            d = date(default_year, month, day)
            return d.strftime('%Y-%m-%d')
        except ValueError:
            pass

    # Pattern 3: YYYY-MM-DD or DD-MM-YYYY
    m3 = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})', name)
    if m3:
        p1, p2, p3 = int(m3.group(1)), int(m3.group(2)), int(m3.group(3))
        year = p3 if p3 > 100 else (2000 + p3)
        try:
            return date(year, p2, p1).strftime('%Y-%m-%d')
        except ValueError:
            try:
                return date(year, p1, p2).strftime('%Y-%m-%d')
            except ValueError:
                pass

    return None

class WorkbookScanner:
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.file_hash = compute_file_hash(filepath)
        self.file_size = os.path.getsize(filepath)

    def scan(self) -> Dict[str, Any]:
        wb = openpyxl.load_workbook(self.filepath, data_only=True, read_only=False)
        sheet_names = wb.sheetnames
        
        sheet_infos = []
        total_sections = 0
        candidate_txns = 0
        warnings = []
        date_sheet_count = 0

        for sname in sheet_names:
            ws = wb[sname]
            detected_date = extract_date_from_sheet_name(sname)
            is_date_sheet = detected_date is not None
            
            # Scan top rows to check for report date if sheet name is not a date
            if not is_date_sheet:
                for r in range(1, min(ws.max_row + 1, 5)):
                    row_vals = [str(ws.cell(r, c).value or '') for c in range(1, 10)]
                    row_txt = ' '.join(row_vals).upper()
                    m = re.search(r'REPORT[-:\s]*(\d{1,2})[-_\s/](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-_\s/]*(\d{2,4})?', row_txt)
                    if m:
                        day = int(m.group(1))
                        month = MONTH_MAP[m.group(2)]
                        yr = int(m.group(3)) if m.group(3) else 2026
                        try:
                            detected_date = date(yr, month, day).strftime('%Y-%m-%d')
                            is_date_sheet = True
                            break
                        except ValueError:
                            pass

            if is_date_sheet:
                date_sheet_count += 1

            # Detect sections in worksheet
            sections_found = set()
            sheet_candidate_rows = 0
            current_section = None

            for r in range(1, ws.max_row + 1):
                row_vals = [ws.cell(r, c).value for c in range(1, 15)]
                while row_vals and row_vals[-1] is None:
                    row_vals.pop()
                if not row_vals:
                    continue
                row_str = ' '.join(str(v).upper() for v in row_vals if v is not None)

                # Section headers
                if 'HDFC RECEIVED' in row_str or ('RECEIVED DETAILS' in row_str and 'SMART' not in row_str and 'PAYZAPP' not in row_str):
                    sections_found.add("BANK_DEPOSIT")
                    current_section = "BANK_DEPOSIT"
                    continue
                elif 'SMART HUB' in row_str or 'PAYZAPP RECEIVED' in row_str or ('QR' in row_str and 'DETAILS' in row_str):
                    sections_found.add("UPI_QR")
                    current_section = "UPI_QR"
                    continue
                elif 'ONLINE PAYMENT' in row_str or 'PAYMENT TRANSACTION' in row_str:
                    sections_found.add("ONLINE_PAYMENT")
                    current_section = "ONLINE_PAYMENT"
                    continue
                elif any(k in row_str for k in ['AKBAR HO', 'YTSK-', 'TOTAL']):
                    if 'TOTAL' in row_str:
                        # End of current table data
                        continue
                    if 'AKBAR HO' in row_str or 'YTSK-' in row_str:
                        current_section = None
                        continue

                # Candidate row check
                if current_section and not any(k in row_str for k in ['SN', 'REPORT-', 'TOTAL']):
                    # Check if row has substantive data (amount, party, or valid serial)
                    has_data = any(v is not None and str(v).strip() != '' for v in row_vals)
                    if has_data:
                        # Ensure not a pure blank placeholder
                        party_candidate = row_vals[1] if len(row_vals) > 1 else None
                        amt_candidate = row_vals[2] if len(row_vals) > 2 else None
                        if party_candidate is not None or (amt_candidate is not None and str(amt_candidate).strip() not in ('', '0', 'None')):
                            sheet_candidate_rows += 1

            sec_count = len(sections_found)
            total_sections += sec_count
            candidate_txns += sheet_candidate_rows

            sheet_infos.append({
                "sheet_name": sname,
                "is_date_sheet": is_date_sheet,
                "detected_date": detected_date,
                "section_count": sec_count,
                "candidate_txns": sheet_candidate_rows,
                "sections_found": list(sections_found)
            })

            if is_date_sheet and sec_count == 0:
                warnings.append(f"Sheet '{sname}' was identified as a date sheet but no recognized transaction sections were found.")

        wb.close()

        return {
            "file_name": os.path.basename(self.filepath),
            "file_hash": self.file_hash,
            "total_sheets": len(sheet_names),
            "date_sheets_count": date_sheet_count,
            "transaction_sections_count": total_sections,
            "candidate_transactions_count": candidate_txns,
            "warnings": warnings,
            "sheets": sheet_infos
        }
