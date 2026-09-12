from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import ClassificationRule, Transaction
from app.schemas.dtos import ClassificationRuleDTO, RuleCreate
from app.engine.classifier import DEFAULT_RULES, SmartClassifier

router = APIRouter(prefix="/api/rules", tags=["Rules"])

@router.get("", response_model=List[ClassificationRuleDTO])
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(ClassificationRule).order_by(ClassificationRule.priority.asc()).all()
    if not rules:
        # Seed default rules
        for r in DEFAULT_RULES:
            db_rule = ClassificationRule(
                name=r["name"],
                pattern=r["pattern"],
                match_field=r["match_field"],
                target_nature=r["target_nature"],
                target_sector=r["target_sector"],
                target_category=r["target_category"],
                confidence_score=r["confidence_score"],
                priority=r["priority"],
                is_active=r.get("is_active", True)
            )
            db.add(db_rule)
        db.commit()
        rules = db.query(ClassificationRule).order_by(ClassificationRule.priority.asc()).all()

    return [{
        "id": r.id,
        "name": r.name,
        "pattern": r.pattern,
        "match_field": r.match_field,
        "target_nature": r.target_nature,
        "target_sector": r.target_sector,
        "target_category": r.target_category,
        "confidence_score": r.confidence_score,
        "priority": r.priority,
        "is_active": r.is_active
    } for r in rules]

@router.post("", response_model=ClassificationRuleDTO)
def create_rule(req: RuleCreate, db: Session = Depends(get_db)):
    rule = ClassificationRule(
        name=req.name,
        pattern=req.pattern,
        match_field=req.match_field,
        target_nature=req.target_nature,
        target_sector=req.target_sector,
        target_category=req.target_category,
        confidence_score=req.confidence_score,
        priority=req.priority,
        is_active=True
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return ClassificationRuleDTO(
        id=rule.id,
        name=rule.name,
        pattern=rule.pattern,
        match_field=rule.match_field,
        target_nature=rule.target_nature,
        target_sector=rule.target_sector,
        target_category=rule.target_category,
        confidence_score=rule.confidence_score,
        priority=rule.priority,
        is_active=rule.is_active
    )

@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(ClassificationRule).filter(ClassificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "SUCCESS", "message": f"Rule {rule_id} deleted"}
