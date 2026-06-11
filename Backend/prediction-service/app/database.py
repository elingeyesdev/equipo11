import os
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "sistema_ambiental")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")

connection_pool = None

def get_pool():
    global connection_pool
    if connection_pool is None:
        try:
            connection_pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=20,
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD
            )
            print("PostgreSQL ThreadedConnectionPool initialized successfully.")
        except Exception as e:
            print(f"Error creating PostgreSQL connection pool: {e}")
            connection_pool = None
            raise e
    return connection_pool

@contextmanager
def get_db():
    db_pool = get_pool()
    conn = None
    try:
        conn = db_pool.getconn()
        conn.autocommit = True
        yield conn
    except Exception as e:
        print(f"Error getting/using DB connection: {e}")
        raise
    finally:
        if conn is not None:
            try:
                db_pool.putconn(conn)
            except Exception as e:
                print(f"Error returning connection to pool: {e}")

def close_pool():
    global connection_pool
    if connection_pool is not None:
        try:
            connection_pool.closeall()
            print("PostgreSQL ThreadedConnectionPool closed successfully.")
        except Exception as e:
            print(f"Error closing PostgreSQL connection pool: {e}")
        finally:
            connection_pool = None
