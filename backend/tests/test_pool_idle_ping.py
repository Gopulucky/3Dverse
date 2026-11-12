"""Every request used to start with an extra "SELECT 1" round trip (pool_pre_ping).
With the API and database in different cities that is pure waiting. The pool now
only checks a connection that has sat idle for a while, which is when a database
or proxy may have silently dropped it."""
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import StaticPool

from app.core.pool import install_idle_ping


def make_engine():
    try:
        import sqlite3 as sqlite
    except ModuleNotFoundError:
        import _sqlite3
        sqlite = SimpleNamespace(**vars(_sqlite3))
        sqlite.paramstyle = "qmark"
        sqlite.sqlite_version_info = tuple(map(int, sqlite.sqlite_version.split(".")))
    return create_engine("sqlite://", module=sqlite, connect_args={"check_same_thread": False}, poolclass=StaticPool)


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture()
def rig():
    engine = make_engine()
    clock = Clock()
    pings = []
    behaviour = {"alive": True}

    def ping(dbapi_connection):
        pings.append(clock.t)
        return behaviour["alive"]

    connects = []
    event.listen(engine, "connect", lambda *_: connects.append(clock.t))
    install_idle_ping(engine, idle_seconds=30, now=clock, ping=ping)
    yield SimpleNamespace(engine=engine, clock=clock, pings=pings, behaviour=behaviour, connects=connects)
    engine.dispose()


def query(engine):
    with engine.connect() as conn:
        return conn.execute(text("select 1")).scalar()


def test_a_new_connection_is_not_pinged(rig):
    assert query(rig.engine) == 1
    assert rig.pings == []


def test_busy_traffic_does_not_ping_at_all(rig):
    query(rig.engine)
    for _ in range(20):
        rig.clock.t += 2
        assert query(rig.engine) == 1
    assert rig.pings == [], "requests a few seconds apart reuse the connection without an extra round trip"


def test_a_connection_idle_for_a_while_is_checked_once(rig):
    query(rig.engine)
    rig.clock.t += 120
    assert query(rig.engine) == 1
    assert len(rig.pings) == 1
    rig.clock.t += 2
    query(rig.engine)
    assert len(rig.pings) == 1, "checked once, then trusted again"


def test_a_dead_idle_connection_is_replaced_without_failing_the_request():
    engine = make_engine()
    clock = Clock()
    connects, pings = [], []
    event.listen(engine, "connect", lambda *_: connects.append(clock.t))

    def ping(dbapi_connection):
        pings.append(clock.t)
        return len(pings) > 1               # the first check finds the connection dead

    install_idle_ping(engine, idle_seconds=30, now=clock, ping=ping)
    assert query(engine) == 1
    assert len(connects) == 1
    clock.t += 120                          # idle long enough that the database may have dropped it
    assert query(engine) == 1, "the request still succeeds"
    assert len(connects) == 2, "a fresh connection replaced the dead one"
    assert len(pings) == 1, "the replacement is new, so it is trusted without another check"
    engine.dispose()
