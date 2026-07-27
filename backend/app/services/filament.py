import math
from sqlalchemy.orm import Session
from app.models.filament_spool import FilamentSpool, ProductFilamentRequirement, ProductionLog


def log_production(db: Session, spool_id: int, product_id: int, units_produced: int) -> ProductionLog:
    req = (db.query(ProductFilamentRequirement)
             .filter_by(product_id=product_id).first())
    if not req:
        raise ValueError("No filament requirement (BOM) defined for this product")

    grams_used = units_produced * req.grams_per_unit

    log = ProductionLog(spool_id=spool_id, product_id=product_id,
                         units_produced=units_produced, grams_used=grams_used)
    db.add(log)

    spool = db.query(FilamentSpool).get(spool_id)
    if remaining_weight_g(db, spool) - grams_used <= 0:
        spool.is_depleted = True

    db.commit()
    return log


def remaining_weight_g(db: Session, spool: FilamentSpool) -> float:
    """Computed from the log, not a decremented column -- avoids double-deduction bugs."""
    used = (db.query(ProductionLog)
              .filter_by(spool_id=spool.id)
              .with_entities(ProductionLog.grams_used).all())
    total_used = sum(g for (g,) in used)
    return spool.total_weight_g - total_used


def whole_units_remaining(db: Session, product_id: int) -> int:
    """
    Floor only the FINAL units-remaining number -- never floor the running
    gram total itself, or small losses compound across many small print runs.
    For multi-material products, take the MINIMUM across all required materials:
    the product is only makeable as many times as its scarcest material allows.
    """
    requirements = (db.query(ProductFilamentRequirement)
                      .filter_by(product_id=product_id).all())
    if not requirements:
        return 0

    limits = []
    for req in requirements:
        spool = (db.query(FilamentSpool)
                   .filter_by(material_type=req.material_type, is_depleted=False)
                   .first())
        if not spool:
            return 0
        remaining = remaining_weight_g(db, spool)
        limits.append(math.floor(remaining / req.grams_per_unit))

    return min(limits)


def reorder_alert(units_left: int, threshold: int = 2) -> bool:
    return units_left <= threshold
