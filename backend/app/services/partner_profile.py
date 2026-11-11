"""Print-partner profile rules, kept free of the database so they can be unit-tested.

The route handlers are thin wrappers around these functions: validation of the
profile and capabilities, the "profile complete" rule for accepting work, which
partners a creator may see, and which ticket state a partner can accept.
"""
from typing import Iterable, Optional

MAX_CAPABILITIES = 30
BIO_MAX = 600

# field -> (min, max) for numeric profile fields
_RANGES = {
    "lead_time_days": (1, 60),
    "price_per_gram_inr": (0, 100_000),
    "min_order_inr": (0, 10_000_000),
    "build_x_mm": (50, 2000),
    "build_y_mm": (50, 2000),
    "build_z_mm": (50, 2000),
}
_TEXT = {"name": 120, "region": 120, "bio": BIO_MAX}
_WHOLE = {"lead_time_days", "build_x_mm", "build_y_mm", "build_z_mm"}   # stored in whole-number columns
_OPTIONAL_NUMBER = {"min_order_inr"}                                     # the only field a partner may clear
MATERIAL_MAX = 60
_BUILD = ("build_x_mm", "build_y_mm", "build_z_mm")

REQUIRED_FOR_WORK = ("capabilities", "lead_time_days", "price_per_gram_inr", "build_volume")

ACCEPTABLE_FROM = "design_submitted"
_ACCEPT_TO = "sample_printing"


class ProfileError(ValueError):
    def __init__(self, problems):
        self.problems = list(problems)
        super().__init__("; ".join(self.problems))


def validate_profile(data: dict) -> dict:
    problems, out = [], {}
    for key, value in data.items():
        if key in _TEXT:
            if value is None:
                out[key] = None
                continue
            if not isinstance(value, str):
                problems.append(f"{key} must be text")
                continue
            value = value.strip()
            if len(value) > _TEXT[key]:
                problems.append(f"{key} must be at most {_TEXT[key]} characters")
                continue
            out[key] = value
        elif key in _RANGES:
            low, high = _RANGES[key]
            if value is None and key in _OPTIONAL_NUMBER:
                out[key] = None
            elif isinstance(value, bool) or not isinstance(value, (int, float)):
                problems.append(f"{key} must be a number")
            elif key in _WHOLE and not float(value).is_integer():
                problems.append(f"{key} must be a whole number")
            elif not (low <= value <= high):
                problems.append(f"{key} must be between {low} and {high}")
            else:
                out[key] = int(value) if key in _WHOLE else value
        else:
            problems.append(f"{key} is not a profile field")
    if problems:
        raise ProfileError(problems)
    return out


def normalise_capabilities(items: Iterable[dict], valid_technologies: set) -> list:
    items = list(items)
    if len(items) > MAX_CAPABILITIES:
        raise ProfileError([f"at most {MAX_CAPABILITIES} capabilities are allowed"])
    seen, out, problems = set(), [], []
    for item in items:
        technology = str(item.get("technology", "")).strip().lower()
        material = str(item.get("material", "")).strip()
        if technology not in valid_technologies:
            problems.append(f"unknown technology: {item.get('technology')!r}")
            continue
        if not material:
            problems.append(f"material is required for {technology}")
            continue
        if len(material) > MATERIAL_MAX:
            problems.append(f"material must be at most {MATERIAL_MAX} characters")
            continue
        key = (technology, material.casefold())
        if key not in seen:
            seen.add(key)
            out.append({"technology": technology, "material": material})
    if problems:
        raise ProfileError(problems)
    return out


def missing_for_work(profile, capabilities) -> list:
    missing = []
    if not capabilities:
        missing.append("capabilities")
    if getattr(profile, "lead_time_days", None) is None:
        missing.append("lead_time_days")
    price = getattr(profile, "price_per_gram_inr", None)
    if price is None or price <= 0:          # a free price is not a real rate
        missing.append("price_per_gram_inr")
    if any(getattr(profile, name, None) is None for name in _BUILD):
        missing.append("build_volume")
    return missing


def can_accept_work(profile, capabilities) -> None:
    missing = missing_for_work(profile, capabilities)
    if missing:
        raise ProfileError(missing)


def filter_partners(partners: Iterable, *, technology: Optional[str] = None, material: Optional[str] = None,
                    min_build_mm: Optional[float] = None) -> list:
    """Only partners who are accepting work, narrowed by the optional filters."""
    out = []
    for partner in partners:
        if not partner.accepting_work:
            continue
        caps = partner.capabilities
        if technology and not any(c["technology"] == technology.lower() for c in caps):
            continue
        if material and not any(c["material"].casefold() == material.strip().casefold() for c in caps):
            continue
        if min_build_mm is not None:
            dims = [getattr(partner, name, None) for name in _BUILD]
            if any(d is None for d in dims) or min(dims) < min_build_mm:
                continue
        out.append(partner)
    return out


def accept_target(status: str) -> str:
    if status != ACCEPTABLE_FROM:
        raise ProfileError(["A ticket can only be accepted once the creator's design has been received."])
    return _ACCEPT_TO
