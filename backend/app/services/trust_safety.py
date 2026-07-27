from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.defect_report import DefectReport
from app.models.order import Order, OrderItem
from app.models.print_partner import PrintPartner
from app.models.collaboration import CollaborationTicket, TicketStatus
from app.models.product import Product

# Deliberately simple, rule-based thresholds -- per the platform doc, this stays
# rule-based until there is enough real dispute/defect history to train a model
# on. Revisit these numbers once real usage data exists; they are not tuned on
# anything yet.
DEFECT_COUNT_THRESHOLD = 3          # reports against one product before flagging
DEFECT_WINDOW_DAYS = 30
RESHIP_RATE_THRESHOLD = 0.15        # partner reship/defect rate above this flags them
TICKET_REJECTION_THRESHOLD = 3      # rejected tickets from/to one party before flagging
TICKET_WINDOW_DAYS = 90


def flag_products_by_defect_rate(db: Session) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=DEFECT_WINDOW_DAYS)
    rows = (
        db.query(Product.id, Product.title, func.count(DefectReport.id))
        .join(Order, DefectReport.order_id == Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(DefectReport.reported_at >= since)
        .group_by(Product.id, Product.title)
        .having(func.count(DefectReport.id) >= DEFECT_COUNT_THRESHOLD)
        .all()
    )
    return [
        {
            "type": "product_defect_rate",
            "product_id": pid,
            "product_title": title,
            "defect_count": count,
            "window_days": DEFECT_WINDOW_DAYS,
            "reason": f"{count} defect reports in the last {DEFECT_WINDOW_DAYS} days",
        }
        for pid, title, count in rows
    ]


def flag_partners_by_reship_rate(db: Session) -> list[dict]:
    partners = db.query(PrintPartner).filter(PrintPartner.total_orders_fulfilled > 0).all()
    flags = []
    for p in partners:
        rate = p.total_defect_reports / p.total_orders_fulfilled
        if rate >= RESHIP_RATE_THRESHOLD:
            flags.append({
                "type": "partner_reship_rate",
                "print_partner_id": p.id,
                "print_partner_name": p.name,
                "reship_defect_rate": round(rate, 3),
                "threshold": RESHIP_RATE_THRESHOLD,
                "reason": f"Reship/defect rate {rate:.1%} is at or above the {RESHIP_RATE_THRESHOLD:.0%} target",
            })
    return flags


def flag_repeated_ticket_disputes(db: Session) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=TICKET_WINDOW_DAYS)
    rows = (
        db.query(CollaborationTicket.creator_id, func.count(CollaborationTicket.id))
        .filter(
            CollaborationTicket.workflow_status == TicketStatus.REJECTED,
            CollaborationTicket.updated_at >= since,
        )
        .group_by(CollaborationTicket.creator_id)
        .having(func.count(CollaborationTicket.id) >= TICKET_REJECTION_THRESHOLD)
        .all()
    )
    creator_flags = [
        {
            "type": "creator_ticket_disputes",
            "creator_id": cid,
            "rejected_count": count,
            "window_days": TICKET_WINDOW_DAYS,
            "reason": f"{count} of this creator's tickets were declined in the last {TICKET_WINDOW_DAYS} days",
        }
        for cid, count in rows
    ]

    partner_rows = (
        db.query(CollaborationTicket.print_partner_id, func.count(CollaborationTicket.id))
        .filter(
            CollaborationTicket.workflow_status == TicketStatus.REJECTED,
            CollaborationTicket.updated_at >= since,
        )
        .group_by(CollaborationTicket.print_partner_id)
        .having(func.count(CollaborationTicket.id) >= TICKET_REJECTION_THRESHOLD)
        .all()
    )
    partner_flags = [
        {
            "type": "partner_ticket_disputes",
            "print_partner_id": pid,
            "rejected_count": count,
            "window_days": TICKET_WINDOW_DAYS,
            "reason": f"This partner declined {count} tickets in the last {TICKET_WINDOW_DAYS} days",
        }
        for pid, count in partner_rows
    ]
    return creator_flags + partner_flags


def all_flags(db: Session) -> list[dict]:
    """
    Everything the doc's §9 risk-signal table calls for, minus the payment-method
    check -- there is no stored payment method to compare across accounts while
    payments remain out of scope. Add it back once a real payment provider is
    wired up and stores a reusable instrument fingerprint.
    """
    return (
        flag_products_by_defect_rate(db)
        + flag_partners_by_reship_rate(db)
        + flag_repeated_ticket_disputes(db)
    )
