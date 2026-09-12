from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import ReconciliationReport
from app.schemas.dtos import ReconciliationReportDTO

router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])

@router.get("", response_model=List[ReconciliationReportDTO])
def list_reconciliations(
    status: Optional[str] = Query(None),
    report_date: Optional[str] = Query(None),
    sheet_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ReconciliationReport)
    if status:
        query = query.filter(ReconciliationReport.status == status)
    if report_date:
        query = query.filter(ReconciliationReport.report_date == report_date)
    if sheet_name:
        query = query.filter(ReconciliationReport.sheet_name == sheet_name)

    reports = query.order_by(ReconciliationReport.report_date.desc()).all()
    return [{
        "id": r.id,
        "sheet_name": r.sheet_name,
        "report_date": r.report_date,
        "section_name": r.section_name,
        "reported_total": r.reported_total,
        "parsed_total": r.parsed_total,
        "difference": r.difference,
        "status": r.status,
        "notes": r.notes
    } for r in reports]
