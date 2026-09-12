import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "HEALTHY"}

def test_dashboard_summary():
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_receipts" in data
    assert "total_expenses" in data
    assert "net_operating_movement" in data
    assert data["total_transactions"] > 1000

def test_daily_audit_endpoints():
    res = client.get("/api/daily-audit")
    assert res.status_code == 200
    summaries = res.json()
    assert len(summaries) > 100

    # Test 2026-09-01 drill-down
    res2 = client.get("/api/daily-audit/2026-09-01")
    assert res2.status_code == 200
    detail = res2.json()
    assert detail["summary"]["summary_date"] == "2026-09-01"
    assert len(detail["receipts"]) > 0
    assert len(detail["expenses"]) > 0

def test_transactions_explorer():
    res = client.get("/api/transactions?page=1&page_size=20")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 1000
    assert len(data["transactions"]) == 20

def test_funds_and_trace():
    res = client.get("/api/funds")
    assert res.status_code == 200
    funds = res.json()
    assert len(funds) > 500

    fund_id = funds[0]["id"]
    res_trace = client.get(f"/api/funds/{fund_id}/trace")
    assert res_trace.status_code == 200
    tree = res_trace.json()
    assert "children" in tree

def test_sector_flow_matrix():
    res = client.get("/api/sectors/flow-matrix")
    assert res.status_code == 200
    matrix = res.json()
    assert "source_sectors" in matrix
    assert "expense_sectors" in matrix
    assert "matrix" in matrix

def test_reconciliation_and_exceptions():
    res_rec = client.get("/api/reconciliation")
    assert res_rec.status_code == 200
    assert len(res_rec.json()) > 300

    res_exc = client.get("/api/exceptions")
    assert res_exc.status_code == 200
    assert len(res_exc.json()) > 0
