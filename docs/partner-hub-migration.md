# Partner hub: database migration

Migration `b4d7e2a91c36` (down revision `d9f2a7b6c104`, which is the live database's current revision) adds 8 columns to `print_partners`:

`accepting_work` (boolean, default false), `bio`, `lead_time_days`, `price_per_gram_inr`, `min_order_inr`, `build_x_mm`, `build_y_mm`, `build_z_mm` (all nullable).

It only adds columns. It does not change or delete any existing data, and existing partner rows stay valid. The SQL it produces (`alembic upgrade d9f2a7b6c104:head --sql`) is eight `ALTER TABLE print_partners ADD COLUMN …` lines plus the version bump.

## It may run automatically when you merge

`render.yaml` starts the API with:

```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

If your live Render service uses that start command (check **Render, your API service, Settings, Start Command**), the migration is applied to the live database **the first time the new code deploys**. If the service was configured by hand with a different command, run it yourself (below).

## Before you merge

1. **Back up the database.** Supabase dashboard, then Database, then Backups (if your plan has it), or from your computer:
   ```bash
   pg_dump "postgresql://USER:PASSWORD@HOST:5432/DB" -Fc -f backup-before-partner-hub.dump
   ```
2. Check the Render start command as above.

## If you must run it yourself

From `backend/`, with your production database settings in `backend/.env`:

```bash
python -m alembic upgrade head
```

Confirm with `python -m alembic current`: it should print `b4d7e2a91c36 (head)`.

## Order of deploys

Old code works against the new columns (they are nullable or defaulted), and the new frontend tolerates an old backend (the partner page just hides the switch). So the order of the Vercel and Render deploys doesn't matter.

## Rolling back

```bash
python -m alembic downgrade d9f2a7b6c104
```

This drops the 8 columns, so any partner profiles saved in the meantime are lost. Restore from the backup if you need them.

## What happens to creators on day one

Nobody has switched "Accepting work" on yet, so **creators will see no print partners** (the page says "No print partners are taking work right now."). Each partner signs in, completes the Profile tab and turns on **Accepting work**. Partner access is still granted by an admin.
