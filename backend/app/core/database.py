from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Pool tuned for a small hosted deploy talking to a pooled Postgres (Supabase's
# Supavisor in session mode caps total client connections, so the pool must stay
# small). Each setting exists for a concrete failure mode:
#   pool_size / max_overflow  keep one instance well under the pooler's client cap
#   pool_recycle              drop connections before the pooler/proxy idles them
#   pool_timeout              fail a request in 10s instead of hanging on a full pool
#   connect_timeout           a database that is down must not hold requests open
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
    pool_timeout=10,
    connect_args={"connect_timeout": 10},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
