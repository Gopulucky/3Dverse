from sqlalchemy.orm import Session
from app.models.print_partner import PrintPartner, PrintPartnerCapability, CreatorPartnerRelationship
from app.models.product import Product, FulfillmentStatus


def recommended_partners(db: Session, product: Product) -> list[dict]:
    """
    Private partnership first (if one exists, it's shown as the top pick but
    NOT force-selected -- the creator still clicks to confirm). Otherwise,
    rank platform partners by technology + material match, then cost tier,
    then defect/reship rate as a tiebreaker.
    """
    private = (db.query(CreatorPartnerRelationship)
                 .filter_by(creator_id=product.creator_id).all())
    private_partner_ids = {p.print_partner_id for p in private}

    matches = (db.query(PrintPartnerCapability)
                 .filter_by(technology=product.technology_required,
                            material_type=product.material_required)
                 .all())

    partners = []
    seen_partner_ids = set()
    for m in matches:
        if m.print_partner_id in seen_partner_ids:
            continue
        seen_partner_ids.add(m.print_partner_id)
        
        partner = db.query(PrintPartner).get(m.print_partner_id)
        reship_rate = (partner.total_defect_reports / partner.total_orders_fulfilled
                        if partner.total_orders_fulfilled else 0)
        partners.append({
            "print_partner_id": partner.id,
            "name": partner.name,
            "region": partner.region,
            "cost_tier": partner.cost_tier,
            "reship_rate": round(reship_rate, 4),
            "is_private_partnership": partner.id in private_partner_ids,
        })

    # Private partnerships surface first, then sort the rest by cost tier then reship rate
    partners.sort(key=lambda p: (not p["is_private_partnership"], p["cost_tier"] or 99, p["reship_rate"]))
    return partners


def assign_partner(db: Session, product: Product, print_partner_id: int) -> Product:
    product.fulfillment_partner_id = print_partner_id
    product.fulfillment_status = FulfillmentStatus.PARTNER_ASSIGNED
    db.commit()
    db.refresh(product)
    return product
