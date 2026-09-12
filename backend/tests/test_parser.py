import os
import pytest
from app.engine.parser import clean_amount, clean_date_str, WorkbookParser

FIXTURE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "test_data", "HDFC BANK RECORD BOOK.xlsx")

def test_clean_amount():
    assert clean_amount("1,80,000") == 180000.0
    assert clean_amount("₹51,000") == 51000.0
    assert clean_amount("(1,500)") == -1500.0
    assert clean_amount(-1500) == -1500.0
    assert clean_amount(0) == 0.0
    assert clean_amount(None) == 0.0
    assert clean_amount("  ") == 0.0

def test_clean_date_str():
    d, t = clean_date_str("01-SEP-2026")
    assert d == "2026-09-01"
    d2, t2 = clean_date_str(None, default_date="2026-05-02")
    assert d2 == "2026-05-02"

def test_parser_transaction_count_and_reconciliation():
    parser = WorkbookParser(FIXTURE_PATH)
    res = parser.parse()
    txns = res["transactions"]
    reconciles = res["reconciliations"]
    assert len(txns) > 1000
    assert len(reconciles) >= 300
    # Ensure vast majority match
    matches = [r for r in reconciles if r["status"] == "MATCH"]
    assert len(matches) / len(reconciles) > 0.85
