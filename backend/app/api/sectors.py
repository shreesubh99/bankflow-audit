import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import Sector, FundAllocation, Fund, Transaction
from app.schemas.dtos import SectorDTO, SectorCreate, SectorFlowMatrixResponse
from app.engine.fund_tracker import FundTrackerEngine

router = APIRouter(prefix="/api/sectors", tags=["Sectors"])

@router.get("", response_model=List[SectorDTO])
def get_sectors(db: Session = Depends(get_db)):
    sectors = db.query(Sector).filter(Sector.is_active == True).all()
    res = []
    for s in sectors:
        try:
            sub = json.loads(s.subsectors_json) if s.subsectors_json else []
        except Exception:
            sub = []
        res.append(SectorDTO(
            id=s.id,
            code=s.code,
            name=s.name,
            subsectors=sub,
            purpose=s.purpose,
            description=s.description,
            is_active=s.is_active
        ))
    return res

@router.post("", response_model=SectorDTO)
def create_sector(req: SectorCreate, db: Session = Depends(get_db)):
    existing = db.query(Sector).filter(Sector.code == req.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Sector with code '{req.code}' already exists")

    sec = Sector(
        code=req.code.upper(),
        name=req.name,
        subsectors_json=json.dumps(req.subsectors),
        purpose=req.purpose,
        description=req.description,
        is_active=True
    )
    db.add(sec)
    db.commit()
    db.refresh(sec)

    return SectorDTO(
        id=sec.id,
        code=sec.code,
        name=sec.name,
        subsectors=req.subsectors,
        purpose=sec.purpose,
        description=sec.description,
        is_active=sec.is_active
    )

@router.get("/flow-matrix", response_model=SectorFlowMatrixResponse)
def get_sector_flow_matrix(db: Session = Depends(get_db)):
    allocations = db.query(FundAllocation).all()
    funds = db.query(Fund).all()
    expenses = db.query(Transaction).filter(Transaction.direction == "OUT").all()

    funds_map = {f.id: {
        "id": f.id,
        "source_sector": f.source_sector
    } for f in funds}

    exp_map = {e.id: {
        "id": e.id,
        "expense_sector": e.expense_sector
    } for e in expenses}

    alloc_dicts = [{
        "fund_id": a.fund_id,
        "expense_txn_id": a.expense_txn_id,
        "amount_allocated": a.amount_allocated
    } for a in allocations]

    matrix_res = FundTrackerEngine.build_sector_flow_matrix(alloc_dicts, funds_map, exp_map)
    return SectorFlowMatrixResponse(**matrix_res)
