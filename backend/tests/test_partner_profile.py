from types import SimpleNamespace

import pytest

from app.services import partner_profile as pp

TECHS = {"fdm", "sla", "sls"}
GOOD = {"name": "Maker Shop", "region": "Bengaluru", "bio": "We print.", "lead_time_days": 5,
        "price_per_gram_inr": 4.5, "min_order_inr": 200, "build_x_mm": 220, "build_y_mm": 220, "build_z_mm": 250}


def problems_of(data):
    with pytest.raises(pp.ProfileError) as info:
        pp.validate_profile(data)
    return " | ".join(info.value.problems)


def test_valid_profile_passes_and_strips():
    out = pp.validate_profile({**GOOD, "name": "  Maker Shop  ", "bio": " We print. "})
    assert out["name"] == "Maker Shop" and out["bio"] == "We print."
    assert pp.validate_profile({"lead_time_days": 1}) == {"lead_time_days": 1}


@pytest.mark.parametrize("field,value", [
    ("lead_time_days", 0), ("lead_time_days", 61), ("price_per_gram_inr", -1), ("price_per_gram_inr", 100001),
    ("min_order_inr", -5), ("build_x_mm", 49), ("build_y_mm", 2001), ("build_z_mm", 0), ("bio", "x" * 601),
])
def test_profile_ranges(field, value):
    assert field in problems_of({field: value})


def test_unknown_keys_are_rejected():
    assert "role" in problems_of({"role": "admin"})


def test_all_problems_are_listed_together():
    text = problems_of({"lead_time_days": 0, "build_x_mm": 1})
    assert "lead_time_days" in text and "build_x_mm" in text


def test_capabilities_are_normalised():
    out = pp.normalise_capabilities([{"technology": "FDM", "material": "PLA"}, {"technology": "fdm", "material": " pla "}], TECHS)
    assert out == [{"technology": "fdm", "material": "PLA"}]
    for bad in ([{"technology": "laser", "material": "PLA"}], [{"technology": "fdm", "material": "  "}],
                [{"technology": "fdm", "material": f"M{i}"} for i in range(31)]):
        with pytest.raises(pp.ProfileError):
            pp.normalise_capabilities(bad, TECHS)


def partner(**over):
    base = dict(accepting_work=True, capabilities=[{"technology": "fdm", "material": "PLA"}], lead_time_days=5,
                price_per_gram_inr=4.5, build_x_mm=220, build_y_mm=220, build_z_mm=250)
    base.update(over)
    return SimpleNamespace(**base)


def test_cannot_accept_work_when_incomplete():
    empty = SimpleNamespace(lead_time_days=None, price_per_gram_inr=None, build_x_mm=None, build_y_mm=None, build_z_mm=None)
    assert pp.missing_for_work(empty, []) == list(pp.REQUIRED_FOR_WORK)
    with pytest.raises(pp.ProfileError) as info:
        pp.can_accept_work(empty, [])
    assert info.value.problems == list(pp.REQUIRED_FOR_WORK)
    full = partner()
    assert pp.can_accept_work(full, full.capabilities) is None
    assert pp.missing_for_work(partner(lead_time_days=None), full.capabilities) == ["lead_time_days"]
    assert pp.missing_for_work(partner(price_per_gram_inr=None), full.capabilities) == ["price_per_gram_inr"]
    assert pp.missing_for_work(partner(build_z_mm=None), full.capabilities) == ["build_volume"]
    assert pp.missing_for_work(full, []) == ["capabilities"]


def test_filter_partners():
    a, b = partner(), partner(accepting_work=False)
    c = partner(capabilities=[{"technology": "sla", "material": "Resin"}], build_x_mm=100, build_y_mm=300, build_z_mm=300)
    d = partner(build_x_mm=None)
    assert pp.filter_partners([a, b, c, d]) == [a, c, d]
    assert pp.filter_partners([a, b, c], technology="sla") == [c]
    assert pp.filter_partners([a, c], material="pla") == [a]
    assert pp.filter_partners([a, c], min_build_mm=200) == [a]          # smallest dimension of c is 100
    assert pp.filter_partners([a, d], min_build_mm=200) == [a]          # no build volume: excluded when asked


@pytest.mark.parametrize("status", ["pending_payment", "paid", "sample_printing", "certified", "negotiating", "agreed", "rejected", "expired"])
def test_accept_rules(status):
    with pytest.raises(pp.ProfileError):
        pp.accept_target(status)


def test_accept_from_design_submitted():
    assert pp.accept_target("design_submitted") == "sample_printing"
    assert pp.ACCEPTABLE_FROM == "design_submitted"


def test_whole_number_fields_reject_fractions():
    for field in ("lead_time_days", "build_x_mm", "build_y_mm", "build_z_mm"):
        assert field in problems_of({field: 100.5 if field != "lead_time_days" else 1.5})
    assert pp.validate_profile({"build_x_mm": 100.0}) == {"build_x_mm": 100}   # a whole float is fine
    assert pp.validate_profile({"price_per_gram_inr": 4.55})["price_per_gram_inr"] == 4.55


def test_only_minimum_order_can_be_cleared():
    assert pp.validate_profile({"min_order_inr": None}) == {"min_order_inr": None}
    for field in ("lead_time_days", "price_per_gram_inr", "build_x_mm", "build_y_mm", "build_z_mm"):
        assert field in problems_of({field: None})


def test_price_of_zero_does_not_count_as_complete():
    full = partner()
    assert pp.missing_for_work(partner(price_per_gram_inr=0), full.capabilities) == ["price_per_gram_inr"]
    assert pp.validate_profile({"price_per_gram_inr": 0}) == {"price_per_gram_inr": 0}   # savable, just not enough to go live


def test_material_length_is_capped():
    ok = pp.normalise_capabilities([{"technology": "fdm", "material": "x" * 60}], TECHS)
    assert len(ok[0]["material"]) == 60
    with pytest.raises(pp.ProfileError):
        pp.normalise_capabilities([{"technology": "fdm", "material": "x" * 61}], TECHS)


def test_accept_message_does_not_expose_the_status_code():
    with pytest.raises(pp.ProfileError) as info:
        pp.accept_target("paid")
    assert "paid" not in info.value.problems[0]
