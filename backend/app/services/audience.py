"""Audience popup: save answers step by step, and turn them into decisions for the owner.

`summarise` and `suggest` are pure so the thresholds are easy to read and test. Suggestions only
appear once there are MIN_RESPONSES answers; before that the numbers are noise.
"""
from collections import Counter, defaultdict
from datetime import datetime
from typing import Iterable

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.audience_response import AudienceResponse

MIN_RESPONSES = 30          # total responses before any suggestion is shown
MIN_ANSWERED = 10           # answers to a single question before it can drive a suggestion
SCALARS = ("role", "city", "owns_printer", "personalise", "bought_where", "spend_band", "missing", "email", "whatsapp")
LISTS = ("uses", "occasions")

LABELS = {
    "gifts": "gifts", "home_decor": "home decor", "hobby": "hobby (tabletop, minis, cosplay)",
    "college_project": "college projects", "useful_parts": "useful or replacement parts", "my_shop": "products for their own shop",
    "sell_designs": "selling their own designs", "exploring": "just exploring",
    "birthday": "birthday", "wedding": "anniversary and wedding", "festival": "festival", "corporate": "corporate", "none": "no particular occasion",
    "marketplace": "Amazon or Flipkart", "etsy_instagram": "Etsy or an Instagram seller", "local_shop": "a local shop",
    "under_500": "under ₹500", "500_1500": "₹500–1,500", "1500_3000": "₹1,500–3,000", "over_3000": "over ₹3,000",
}


def save_answers(db: Session, data, _retry: bool = True) -> None:
    """Merge what the visitor has answered so far into their row. Missing fields never blank saved ones."""
    now = datetime.utcnow()
    row = db.query(AudienceResponse).filter(AudienceResponse.response_id == data.response_id).first()
    if row is None:
        row = AudienceResponse(response_id=data.response_id, created_at=now, step_reached=1, chat_ok=False)
        db.add(row)
    for field in (*SCALARS, *LISTS):
        value = getattr(data, field)
        if value is not None:
            setattr(row, field, value)
    if data.chat_ok is not None:
        row.chat_ok = data.chat_ok
    if data.anon_id and not row.anon_id:
        row.anon_id = data.anon_id
    row.step_reached = max(row.step_reached or 1, data.step)
    if data.consent is True and (data.email or data.whatsapp or data.chat_ok):
        row.consented_at = now
    try:
        db.commit()
    except IntegrityError:  # two first saves for the same visitor raced; the other one won
        db.rollback()
        if _retry:
            save_answers(db, data, _retry=False)
        else:
            raise


def _count(values: Iterable) -> dict:
    return dict(Counter(value for value in values if value).most_common())


def summarise(rows) -> dict:
    rows = list(rows)
    cities: Counter = Counter()
    labels: dict[str, str] = {}
    use_by_role: dict[str, Counter] = defaultdict(Counter)
    for row in rows:
        if row.city and row.city.strip():
            key = row.city.strip().casefold()
            cities[key] += 1
            labels.setdefault(key, row.city.strip())
        if row.role:
            for use in row.uses or []:
                use_by_role[row.role][use] += 1
    summary = {
        "total": len(rows),
        "with_email": sum(1 for row in rows if row.email),
        "chat_ok": sum(1 for row in rows if row.chat_ok),
        "by_role": _count(row.role for row in rows),
        "by_use": _count(use for row in rows for use in row.uses or []),
        "by_occasion": _count(item for row in rows for item in row.occasions or []),
        "by_printer": _count(row.owns_printer for row in rows),
        "by_personalise": _count(row.personalise for row in rows),
        "by_bought_where": _count(row.bought_where for row in rows),
        "by_spend": _count(row.spend_band for row in rows),
        "top_cities": [{"city": labels[key], "count": n} for key, n in cities.most_common(10)],
        "use_by_role": {role: dict(counter.most_common()) for role, counter in use_by_role.items()},
        "missing": [
            {"text": row.missing, "role": row.role, "city": row.city, "created_at": row.created_at.isoformat() if row.created_at else None}
            for row in sorted((r for r in rows if r.missing), key=lambda r: r.created_at or datetime.min, reverse=True)[:50]
        ],
        "responses": [
            {"created_at": row.created_at.isoformat() if row.created_at else None, "step_reached": row.step_reached,
             "role": row.role, "city": row.city, "uses": row.uses or [], "occasions": row.occasions or [],
             "owns_printer": row.owns_printer, "personalise": row.personalise, "bought_where": row.bought_where,
             "spend_band": row.spend_band, "missing": row.missing, "email": row.email, "whatsapp": row.whatsapp,
             "chat_ok": bool(row.chat_ok)}
            for row in rows
        ],
    }
    summary["suggestions"] = suggest(summary, rows)
    return summary


def _share(counts: dict, keys: Iterable[str]) -> tuple[int, float]:
    """(answered, share of answered that chose any of `keys`) for a single-choice question."""
    keys = tuple(keys)
    answered = sum(counts.values())
    return answered, (sum(counts.get(key, 0) for key in keys) / answered if answered else 0.0)


def _percent(share: float) -> str:
    return f"{round(share * 100)}%"


def suggest(summary: dict, rows) -> list[str]:
    """Plain-language decisions the numbers support. Empty until there are enough responses."""
    if summary["total"] < MIN_RESPONSES:
        return []
    rows = list(rows)
    out: list[str] = []

    answered_uses = sum(1 for row in rows if row.uses)
    gifts = sum(1 for row in rows if "gifts" in (row.uses or []))
    if answered_uses >= MIN_ANSWERED and gifts / answered_uses >= 0.30:
        top = next(iter(summary["by_occasion"]), None)
        occasion = f" Lead with {LABELS[top]} gifts." if top and top != "none" else ""
        out.append(f"{_percent(gifts / answered_uses)} want gifts: add more gift products (birthday, anniversary, festival).{occasion}")
    other_uses = [use for use in summary["by_use"] if use not in ("gifts", "exploring")]
    if other_uses and answered_uses >= MIN_ANSWERED and summary["by_use"][other_uses[0]] / answered_uses >= 0.30:
        out.append(f"{_percent(summary['by_use'][other_uses[0]] / answered_uses)} want {LABELS[other_uses[0]]}: make it a main category.")

    if summary["top_cities"]:
        city = summary["top_cities"][0]
        named = sum(item["count"] for item in summary["top_cities"])
        if named >= MIN_ANSWERED and city["count"] / named >= 0.25:
            out.append(f"{_percent(city['count'] / named)} of those who named a city are in {city['city']}: recruit a print partner there first and aim ads there.")

    answered, no_printer = _share(summary["by_printer"], ("no", "planning"))
    _, has_printer = _share(summary["by_printer"], ("yes",))
    if answered >= MIN_ANSWERED and no_printer >= 0.60:
        out.append(f"{_percent(no_printer)} do not own a 3D printer: prioritise finished prints over digital files.")
    elif answered >= MIN_ANSWERED and has_printer >= 0.50:
        out.append(f"{_percent(has_printer)} already own a 3D printer: prioritise digital files.")

    answered, wants = _share(summary["by_personalise"], ("always", "sometimes"))
    if answered >= MIN_ANSWERED and wants >= 0.60:
        out.append(f"{_percent(wants)} want personalisation (name, photo, logo): make made-to-order a headline feature.")

    bought = {key: n for key, n in summary["by_bought_where"].items() if key not in ("never", "made_it")}
    if sum(summary["by_bought_where"].values()) >= MIN_ANSWERED and bought:
        out.append(f"Most people who bought before used {LABELS[next(iter(bought))]}: study their prices and listings first.")
    if sum(summary["by_spend"].values()) >= MIN_ANSWERED:
        out.append(f"The most common past spend was {LABELS[next(iter(summary['by_spend']))]}: price your first products near it.")

    answered_roles = sum(summary["by_role"].values())
    if answered_roles >= MIN_ANSWERED:
        designers = summary["by_role"].get("designer", 0)
        if designers / answered_roles >= 0.15:
            out.append(f"{_percent(designers / answered_roles)} are designers: recruit creators early so the catalogue fills up.")
        business = summary["by_role"].get("business", 0)
        if business / answered_roles >= 0.15:
            out.append(f"{_percent(business / answered_roles)} are small businesses or brands: consider bulk and trade pricing.")
    return out
