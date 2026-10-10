from sqlalchemy import create_engine

DATABASE_URL = "postgresql+psycopg://localhost/cleanbharat"

engine = create_engine(DATABASE_URL)

with engine.connect() as connection:
    print("Database connected successfully!")