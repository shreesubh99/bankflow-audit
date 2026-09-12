import os
import pytest
from app.engine.scanner import extract_date_from_sheet_name, WorkbookScanner

FIXTURE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "test_data", "HDFC BANK RECORD BOOK.xlsx")

def test_extract_date_formats():
    assert extract_date_from_sheet_name("01-MAY", 2026) == "2026-05-01"
    assert extract_date_from_sheet_name("2-MAY", 2026) == "2026-05-02"
    assert extract_date_from_sheet_name("15-JUL", 2026) == "2026-07-15"
    assert extract_date_from_sheet_name("30-AUG", 2026) == "2026-08-30"
    assert extract_date_from_sheet_name("01-SEP", 2026) == "2026-09-01"
    assert extract_date_from_sheet_name("Sheet81", 2026) is None

def test_scanner_on_fixture():
    assert os.path.exists(FIXTURE_PATH), "Fixture file must exist"
    scanner = WorkbookScanner(FIXTURE_PATH)
    res = scanner.scan()
    assert res["total_sheets"] >= 118
    assert res["date_sheets_count"] >= 118
    assert res["transaction_sections_count"] >= 354
    assert res["candidate_transactions_count"] > 1000
