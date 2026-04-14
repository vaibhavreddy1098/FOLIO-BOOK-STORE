import datetime
from src.data_connection.connection import connect_db, disconnect_db
from authentication.hashing import hash_password


def add_admin(email: str = "admin@example2.com", password: str = "admin12345") -> None:
    conn = connect_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT user_id FROM users WHERE email = %s",
            (email,)
        )
        existing_admin = cursor.fetchone()

        if existing_admin:
            print("Admin user already exists.")
            return

        hashed_password = hash_password(password)

        cursor.execute("""
            INSERT INTO users (email, password, role, created_at)
            VALUES (%s, %s, %s, %s)
        """, (
            email,
            hashed_password,
            "admin",
            datetime.datetime.utcnow()
        ))

        conn.commit()
        print("Admin user added successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Failed to add admin: {e}")
        raise

    finally:
        try:
            cursor.close()
        except:
            pass
        disconnect_db()