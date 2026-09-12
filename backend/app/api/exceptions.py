from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import AuditFlag, Transaction
from app.schemas.dtos import AuditFlagDTO, ResolveExceptionRequest, TransactionDTO

router = APIRouter(prefix="/api/exceptions", tags=["Audit Exceptions"])

@router.get("", response_model=List[AuditFlagDTO])
def list_exceptions(
    flag_type: Optional[str] = Query(None),
    status: Optional[str] = Query("OPEN"),
    severity: Optional[str] = Query(None),
    sheet_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(AuditFlag)
    if status and status != "ALL":
        query = query.filter(AuditFlag.status == status)
    if flag_type:
        query = query.filter(AuditFlag.flag_type == flag_type)
    if severity:
        query = query.filter(AuditFlag.severity == severity)
    if sheet_name:
        query = query.filter(AuditFlag.sheet_name == sheet_name)

    flags = query.order_by(AuditFlag.created_at.desc()).limit(300).all()

    results = []
    for f in flags:
        txn_dto = None
        if f.txn_id:
            txn = db.query(Transaction).filter(Transaction.id == f.txn_id).first()
            if txn:
                txn_dto = TransactionDTO.model_validate(txn)

        results.append(AuditFlagDTO(
            id=f.id,
            import_id=f.import_id,
            txn_id=f.txn_id,
            sheet_name=f.sheet_name,
            flag_type=f.flag_type,
            severity=f.severity,
            description=f.description,
            status=f.status,
            created_at=f.created_at.isoformat() if f.created_at else None,
            resolved_at=f.resolved_at.isoformat() if f.resolved_at else None,
            resolved_by=f.resolved_by,
            resolution_notes=f.resolution_notes,
            txn_details=txn_dto
        ))

    return results

@router.post("/{flag_id}/resolve")
def resolve_exception(flag_id: int, req: ResolveExceptionRequest, db: Session = Depends(get_db)):
    flag = db.query(AuditFlag).filter(AuditFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Audit flag not found")

    flag.status = "RESOLVED" if req.action in ("KEEP", "MARK_VALID", "OVERRIDE") else "IGNORED" if req.action == "IGNORE" else "MERGED"
    flag.resolved_at = datetime.utcnow()
    flag.resolved_by = "USER"
    flag.resolution_notes = f"Action: {req.action}. Notes: {req.notes or 'None'}"

    # If associated with a transaction, update audit flag on transaction
    if flag.txn_id:
        txn = db.query(Transaction).filter(Transaction.id == flag.txn_id).first()
        if txn:
            if req.action == "MARK_VALID":
                txn.audit_flag = None
                txn.is_duplicate = False
            elif req.action == "IGNORE":
                txn.status = "IGNORED"

    db.commit()
    return {"status": "SUCCESS", "message": f"Audit flag {flag_id} resolved with action '{req.action}'"}
