"""app.core.config validates its environment at import time, so each case runs
in a fresh interpreter with a controlled environment."""
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def run_config(env_overrides: dict, code: str = "import app.core.config as c; print('OK')"):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("POSTGRES_", "SECRET_KEY", "ENVIRONMENT", "BACKEND_CORS", "REDIS_"))}
    env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", code], cwd=BACKEND, env=env, capture_output=True, text=True, timeout=60
    )


def test_development_defaults_boot():
    r = run_config({"ENVIRONMENT": "development"})
    assert r.returncode == 0, r.stderr
    assert "OK" in r.stdout


def test_production_refuses_the_default_secret_key():
    r = run_config({"ENVIRONMENT": "production"})
    assert r.returncode != 0
    assert "SECRET_KEY" in r.stderr


def test_production_boots_with_a_real_secret_key():
    r = run_config({"ENVIRONMENT": "production", "SECRET_KEY": "x" * 48})
    assert r.returncode == 0, r.stderr


def test_any_non_development_value_counts_as_production():
    # A typo like "prod" or "staging" must fail safe (production rules), not
    # silently fall back to the permissive development mode.
    r = run_config({"ENVIRONMENT": "staging"}, "import app.core.config as c; print(c.settings.is_production)")
    assert r.returncode != 0  # default secret key is rejected, proving it is treated as production


def test_malformed_postgres_server_is_rejected_with_a_clear_message():
    for bad in ("db.example.com", "db.example.com:", ":5432", "db.example.com:abc"):
        r = run_config({"ENVIRONMENT": "development", "POSTGRES_SERVER": bad})
        assert r.returncode != 0, bad
        assert "POSTGRES_SERVER" in r.stderr


def test_cors_accepts_comma_list_and_json_and_always_includes_the_vercel_site():
    code = "import app.core.config as c; print('|'.join(c.settings.BACKEND_CORS_ORIGINS))"
    comma = run_config({"BACKEND_CORS_ORIGINS": "http://a.test, http://b.test"}, code)
    assert comma.returncode == 0, comma.stderr
    assert "http://a.test" in comma.stdout and "http://b.test" in comma.stdout
    assert "https://3dverse-tan.vercel.app" in comma.stdout

    js = run_config({"BACKEND_CORS_ORIGINS": '["http://c.test"]'}, code)
    assert js.returncode == 0, js.stderr
    assert "http://c.test" in js.stdout


def test_database_password_with_special_characters_is_url_encoded():
    code = "import app.core.config as c; print(c.settings.SQLALCHEMY_DATABASE_URI)"
    r = run_config({"POSTGRES_PASSWORD": "p@ss/w:rd#1", "POSTGRES_USER": "u", "POSTGRES_SERVER": "h:5432", "POSTGRES_DB": "d"}, code)
    assert r.returncode == 0, r.stderr
    uri = r.stdout.strip()
    assert "p%40ss%2Fw%3Ard%231" in uri
    assert uri.startswith("postgresql+psycopg://u:")


def test_redis_url_override_wins_over_host_fields():
    code = "import app.core.config as c; print(c.settings.REDIS_URL)"
    r = run_config({"REDIS_URL": "rediss://x.example:6380/1", "REDIS_HOST": "ignored"}, code)
    assert r.stdout.strip() == "rediss://x.example:6380/1"
