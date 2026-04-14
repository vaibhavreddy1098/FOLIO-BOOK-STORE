import bcrypt
from fastapi import HTTPException
from authentication.jwt import create_access_token
from src.data_connection.connection import connect_db, disconnect_db
from src.logger import logging

class LoginManager:
    def __init__(self):
        self.conn = connect_db()
        self.cursor = self.conn.cursor()

    def login(self, email: str, password: str) -> dict:
        try:
            # 1. Fetch user from database
            self.cursor.execute("""
                SELECT user_id, email, password, role
                FROM users
                WHERE email = %s
            """, (email,))

            user_data = self.cursor.fetchone()

            if not user_data:
                logging.warning(f"Login failed for email: {email}")
                # Use standard HTTPException instead of broken MyException
                raise HTTPException(status_code=401, detail="Invalid email or password")

            user_id, db_email, hashed_password, role = user_data

            # 2. 🔐 Verify password using raw bcrypt to bypass passlib issues
            password_bytes = password.encode('utf-8')
            hashed_bytes = hashed_password.encode('utf-8')

            if not bcrypt.checkpw(password_bytes, hashed_bytes):
                logging.warning(f"Invalid password for email: {email}")
                raise HTTPException(status_code=401, detail="Invalid email or password")

            # 3. Generate Token
            token_data = {
                "user_id": user_id,
                "email": db_email,
                "role": role
            }

            access_token = create_access_token(token_data)

            logging.info(f"User {email} logged in successfully")
            return {
                "access_token": access_token,
                "user_id": user_id,
                "email": db_email,
                "role": role
            }

        except HTTPException:
            # Re-raise HTTPExceptions so FastAPI can send them to the frontend
            raise
        except Exception as e:
            logging.error(f"Login error: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal Server Error")

    def __del__(self):
        try:
            disconnect_db() 
        except:
            logging.error("Error occurred while closing the database connection")