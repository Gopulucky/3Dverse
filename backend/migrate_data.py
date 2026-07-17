import urllib.parse
from sqlalchemy import create_engine, MetaData, text

# URLs
native_url = f"postgresql+psycopg://postgres:{urllib.parse.quote_plus('Binnu@123')}@localhost:5432/3dverse"
docker_url = "postgresql+psycopg://3dverse_user:3dverse_password@localhost:5433/3dverse"

engine_native = create_engine(native_url)
engine_docker = create_engine(docker_url)

meta_native = MetaData()
meta_native.reflect(bind=engine_native)

# Copy all tables
with engine_native.connect() as conn_native:
    with engine_docker.connect() as conn_docker:
        # Disable foreign key checks momentarily if possible, or just copy in dependency order
        # Assuming alembic_version is first
        
        # We need to sort tables by foreign key dependencies
        tables = meta_native.sorted_tables
        
        # Clear tables in docker first (they should be empty except alembic_version)
        for table in reversed(tables):
            try:
                conn_docker.execute(table.delete())
                conn_docker.commit()
            except Exception as e:
                print(f"Skipping delete for {table.name}: {e}")
                
        # Insert data
        for table in tables:
            print(f"Copying {table.name}...")
            rows = conn_native.execute(table.select()).fetchall()
            if not rows:
                continue
                
            # Convert rows to dicts
            dicts = [dict(zip(table.columns.keys(), row)) for row in rows]
            conn_docker.execute(table.insert(), dicts)
            conn_docker.commit()

        # Update sequences for auto-increment PKs
        for table in tables:
            if table.name == "alembic_version": continue
            # postgres sequence name is usually table_id_seq
            seq_name = f"{table.name}_id_seq"
            try:
                conn_docker.execute(text(f"SELECT setval('{seq_name}', (SELECT max(id) FROM {table.name}))"))
                conn_docker.commit()
            except:
                pass
                
print("Data migration complete!")
