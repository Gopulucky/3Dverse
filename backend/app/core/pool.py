"""Connection-pool health check that only costs a round trip when it is needed.

`pool_pre_ping=True` sends a `SELECT 1` before *every* request. When the API and
the database are in different cities that is a full extra round trip per request.
The risk it guards against, a database or proxy silently dropping a connection,
only exists for connections that have been idle for a while. So check those, and
let busy connections be reused straight away.
"""
import time
from typing import Callable

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DisconnectionError

DEFAULT_IDLE_SECONDS = 30.0


def install_idle_ping(
    engine: Engine,
    idle_seconds: float = DEFAULT_IDLE_SECONDS,
    now: Callable[[], float] = time.monotonic,
    ping: Callable | None = None,
) -> None:
    """Ping a pooled connection on checkout only if it sat unused for `idle_seconds`.

    A failed check raises DisconnectionError, which makes the pool discard that
    connection and open a fresh one, so the request itself never fails."""
    check = ping or engine.dialect.do_ping

    @event.listens_for(engine, "connect")
    def _stamp_new(dbapi_connection, connection_record):
        connection_record.info["last_used"] = now()

    @event.listens_for(engine, "checkin")
    def _stamp_returned(dbapi_connection, connection_record):
        connection_record.info["last_used"] = now()

    @event.listens_for(engine, "checkout")
    def _ping_if_idle(dbapi_connection, connection_record, connection_proxy):
        last_used = connection_record.info.get("last_used")
        if last_used is not None and now() - last_used < idle_seconds:
            return
        try:
            alive = check(dbapi_connection)
        except Exception as error:
            raise DisconnectionError("Pooled connection did not answer after sitting idle") from error
        if not alive:
            raise DisconnectionError("Pooled connection did not answer after sitting idle")
