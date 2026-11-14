"""Funnel tracking: record anonymous steps and summarise them for the admin.

Nothing here may get in the way of a purchase: callers on the payment path wrap these
in their own error handling, and the public endpoint swallows storage errors.
"""
from collections import defaultdict
from typing import Iterable, Mapping

from sqlalchemy.orm import Session

from app.models.funnel_event import FunnelEvent

# Display order of the report, from first contact to money.
STEPS = ("landing", "product_view", "viewer_opened", "add_to_cart", "buy_now",
         "checkout_started", "payment_opened", "paid", "waitlist_joined")
DIRECT = "direct"  # visitors who arrived without a ?src= or utm_source


def track_events(batch, db: Session) -> None:
    for event in batch.events:
        db.add(FunnelEvent(anon_id=batch.anon_id, event=event.event, product_id=event.product_id,
                           source=event.source, medium=event.medium, campaign=event.campaign, path=event.path))
    db.commit()


def record_checkout_started(db: Session, order_id: int, visitor: Mapping | None) -> None:
    """Once per order, with the visitor's source, so a later `paid` can be credited to a channel."""
    if not visitor:
        return
    if db.query(FunnelEvent.id).filter(FunnelEvent.order_id == order_id, FunnelEvent.event == "checkout_started").first():
        return
    db.add(FunnelEvent(anon_id=visitor["anon_id"], event="checkout_started", order_id=order_id,
                       source=visitor.get("source"), medium=visitor.get("medium"), campaign=visitor.get("campaign")))


def record_paid(db: Session, order) -> None:
    """Once per order, credited to the visitor who started that checkout (if we know them)."""
    if db.query(FunnelEvent.id).filter(FunnelEvent.order_id == order.id, FunnelEvent.event == "paid").first():
        return
    started = (db.query(FunnelEvent).filter(FunnelEvent.order_id == order.id, FunnelEvent.event == "checkout_started")
               .order_by(FunnelEvent.id).first())
    db.add(FunnelEvent(anon_id=started.anon_id if started else f"order-{order.id}", event="paid", order_id=order.id,
                       source=started.source if started else None, medium=started.medium if started else None,
                       campaign=started.campaign if started else None))
    db.flush()


def summarise_funnel(rows: Iterable, titles: Mapping[int, str]) -> dict:
    """Counts per step, per channel and per product. `visitors` counts distinct anonymous ids."""
    rows = list(rows)
    counts: dict[str, int] = defaultdict(int)
    people: dict[str, set] = defaultdict(set)
    source_people: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    source_all: dict[str, set] = defaultdict(set)
    products: dict[int, dict[str, int]] = {}
    for row in rows:
        counts[row.event] += 1
        people[row.event].add(row.anon_id)
        source = row.source or DIRECT
        source_people[source][row.event].add(row.anon_id)
        source_all[source].add(row.anon_id)
        if row.product_id and row.event in ("product_view", "add_to_cart", "buy_now"):
            bucket = products.setdefault(row.product_id, {"views": 0, "carts": 0, "buys": 0})
            bucket[{"product_view": "views", "add_to_cart": "carts", "buy_now": "buys"}[row.event]] += 1
    return {
        "steps": [{"event": step, "count": counts[step], "visitors": len(people[step])} for step in STEPS],
        "by_source": [
            {"source": source, "visitors": len(source_all[source]),
             "steps": {step: len(source_people[source][step]) for step in STEPS}}
            for source in sorted(source_all, key=lambda name: (-len(source_all[name]), name))
        ],
        "by_product": [
            {"product_id": pid, "title": titles.get(pid) or f"Product {pid}", **bucket}
            for pid, bucket in sorted(products.items(), key=lambda item: (-item[1]["views"], item[0]))
        ],
    }
