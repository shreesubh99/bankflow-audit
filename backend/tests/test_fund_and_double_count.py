import pytest
from app.engine.double_count import DoubleCountEngine
from app.engine.self_transfer import SelfTransferEngine
from app.engine.fund_tracker import FundTrackerEngine

def test_double_count_mitigation():
    transactions = [
        {
            "id": "tx1",
            "txn_date": "2026-09-01",
            "source_table": "UPI_QR",
            "direction": "IN",
            "transaction_nature": "UPI QR COLLECTION",
            "amount": 10000.0,
            "value_date": "2026-09-02"
        },
        {
            "id": "tx2",
            "txn_date": "2026-09-02",
            "source_table": "BANK_DEPOSIT",
            "direction": "IN",
            "transaction_nature": "UPI SETTLEMENT",
            "amount": 10000.0,
            "value_date": "2026-09-01"
        }
    ]

    processed, links = DoubleCountEngine.process_settlements(transactions)
    # The bank settlement should be converted to INTERNAL so revenue is not double-counted
    settle_tx = next(t for t in processed if t["id"] == "tx2")
    assert settle_tx["direction"] == "INTERNAL"
    assert len(links) == 1
    assert links[0]["source_txn_id"] == "tx1"
    assert links[0]["target_txn_id"] == "tx2"

def test_self_transfer_detection():
    assert SelfTransferEngine.evaluate("SHREE SHUBH", "SELF TR") is True
    assert SelfTransferEngine.evaluate("RAVIVO AIR TICKET", "COCKPIT") is False

    txns = [
        {"id": "t1", "party_name": "SHREE SHUBH", "description": "SELF TR", "direction": "IN", "source_table": "UPI_QR", "transaction_nature": "CUSTOMER RECEIPT"},
        {"id": "t2", "party_name": "HOTEL TAJ", "description": "ROOM BOOKING", "direction": "OUT", "source_table": "ONLINE_PAYMENT", "transaction_nature": "EXPENSE"},
        {"id": "t3", "party_name": "SHREE SHUBH TRAVEL", "description": "SELF TR", "direction": "OUT", "source_table": "ONLINE_PAYMENT", "transaction_nature": "EXPENSE"}
    ]
    applied = SelfTransferEngine.apply(txns)
    assert applied[0]["direction"] == "INTERNAL"
    assert applied[0]["transaction_nature"] == "SELF TRANSFER"
    assert applied[1]["direction"] == "OUT"
    assert applied[2]["direction"] == "OUT"
    assert applied[2]["transaction_nature"] == "PERSONAL EXPENSE"
    assert applied[2]["category"] == "PERSONAL EXPENSES"
    assert applied[2]["expense_sector"] == "PERSONAL"

def test_fund_tracker_and_trace():
    receipts = [
        {"id": "r1", "txn_date": "2026-09-01", "direction": "IN", "amount": 50000.0, "source_sector": "AKBAR"},
    ]
    funds, _ = FundTrackerEngine.generate_funds_from_receipts(receipts)
    assert len(funds) == 1
    assert funds[0]["original_amount"] == 50000.0
    assert funds[0]["remaining_amount"] == 50000.0

    expenses = [
        {"id": "e1", "txn_date": "2026-09-02", "direction": "OUT", "amount": 8000.0, "expense_sector": "HOTEL", "party_name": "HOTEL PURI"},
        {"id": "e2", "txn_date": "2026-09-03", "direction": "OUT", "amount": 12000.0, "expense_sector": "YTSK", "party_name": "YTSK TICKET"},
        {"id": "e3", "txn_date": "2026-09-04", "direction": "OUT", "amount": 5000.0, "expense_sector": "PASSPORT", "party_name": "PASSPORT SEVA"}
    ]
    allocs = FundTrackerEngine.auto_allocate_fifo(funds, expenses)
    assert len(allocs) == 3
    assert funds[0]["spent_amount"] == 25000.0
    assert funds[0]["remaining_amount"] == 25000.0
    assert funds[0]["status"] == "PARTIALLY USED"

    # Forward Trace Tree
    exp_map = {e["id"]: e for e in expenses}
    tree = FundTrackerEngine.build_fund_trace_tree(funds[0], allocs, exp_map)
    assert tree["type"] == "sector"
    assert len(tree["children"]) == 1 # Fund node
    fund_node = tree["children"][0]
    assert len(fund_node["children"]) == 4 # 3 expenses + 1 remaining node

    # Reverse Trace
    funds_map = {funds[0]["id"]: funds[0]}
    rev = FundTrackerEngine.build_reverse_trace(expenses[1], allocs, funds_map)
    assert rev["expense_id"] == "e2"
    assert rev["funded_amount"] == 12000.0
    assert len(rev["funding_sources"]) == 1

def test_chronological_causality_no_future_funds_to_past_expenses():
    """Future receipts (e.g. 04-Sep) can never fund expenses that occurred in the past (e.g. 26-Aug)."""
    receipts = [
        {"id": "r_future", "txn_date": "2026-09-04", "direction": "IN", "amount": 2880.0, "source_sector": "YTSK"}
    ]
    funds, _ = FundTrackerEngine.generate_funds_from_receipts(receipts)

    expenses = [
        {"id": "e_past", "txn_date": "2026-08-26", "direction": "OUT", "amount": 2880.0, "expense_sector": "YTSK", "party_name": "INDIAN RAILWAY"},
        {"id": "e_future", "txn_date": "2026-09-05", "direction": "OUT", "amount": 2880.0, "expense_sector": "YTSK", "party_name": "INDIAN RAILWAY"}
    ]
    allocs = FundTrackerEngine.auto_allocate_fifo(funds, expenses)

    # e_past on 2026-08-26 cannot receive money from 2026-09-04 fund!
    assert len(allocs) == 1
    assert allocs[0]["expense_txn_id"] == "e_future"
    assert allocs[0]["allocation_date"] == "2026-09-05"
    assert funds[0]["spent_amount"] == 2880.0
    assert funds[0]["remaining_amount"] == 0.0

