"""The home page rows used to be cut to four products, so wide screens showed
three or four cards and a large empty space. The shelves must be long enough to
fill a full-width row and still give the rail something to scroll."""
import inspect

import app.main  # noqa: F401  (registers every model, as in production)
from app.api.routers import marketplace


def test_shelves_are_long_enough_to_fill_a_wide_row():
    assert marketplace.HOME_NEW_LIMIT >= 12
    assert marketplace.HOME_TRENDING_LIMIT >= 12
    assert marketplace.HOME_FEATURED_LIMIT >= 6


def test_homepage_queries_use_the_named_limits():
    source = inspect.getsource(marketplace._build_homepage)
    for name in ("HOME_FEATURED_LIMIT", "HOME_TRENDING_LIMIT", "HOME_NEW_LIMIT"):
        assert name in source, name
    assert ".limit(4)" not in source


def test_trending_ties_break_by_newest_so_the_row_is_stable():
    source = inspect.getsource(marketplace._build_homepage)
    assert "desc(Product.mock_order_count), desc(Product.created_at)" in source
