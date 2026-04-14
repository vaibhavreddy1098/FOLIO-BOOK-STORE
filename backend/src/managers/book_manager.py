import sys
from src.data_connection.connection import connect_db, disconnect_db
from src.logger import logging
from src.exception import MyException
from src.artifacts.entities import book_new


class BookADD:
    def __init__(self):
        self.conn = connect_db()
        self.cursor = self.conn.cursor()

    def check_admin(self, user_id: int) -> bool:
        self.cursor.execute(
            "SELECT role FROM users WHERE user_id = %s",
            (user_id,)
        )
        row = self.cursor.fetchone()
        return bool(row and row[0] in ("admin", "super_admin"))

    def add_book(self, user_id: int, book_info: book_new) -> int:
        try:
            if not self.check_admin(user_id):
                raise Exception("Admin access required")

            valid_types = {"new", "used"}
            valid_formats = {"hardcover", "softcover", "ebook"}
            valid_purchase = {"rent", "buy"}

            if book_info.type not in valid_types:
                raise Exception("Invalid type. Use 'new' or 'used'.")

            if book_info.format not in valid_formats:
                raise Exception("Invalid format. Use hardcover, softcover, or ebook.")

            if book_info.purchase_option not in valid_purchase:
                raise Exception("Invalid purchase option. Use rent or buy.")

            self.cursor.execute(
                "SELECT book_id FROM books WHERE isbn = %s",
                (book_info.isbn,)
            )
            if self.cursor.fetchone():
                raise Exception("Book already exists for this ISBN.")

            self.cursor.execute("""
                INSERT INTO books
                (title, isbn, publisher, price, quantity, type,
                 purchase_option, format, language, edition, category)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                book_info.title,
                book_info.isbn,
                book_info.publisher,
                book_info.price,
                book_info.quantity,
                book_info.type,
                book_info.purchase_option,
                book_info.format,
                book_info.language,
                book_info.edition,
                book_info.category
            ))

            book_id = self.cursor.lastrowid
            self.conn.commit()

            logging.info(f"Book added successfully with ID: {book_id}")
            
            book_id = self.cursor.lastrowid

        except Exception as e:
            self.conn.rollback()
            logging.exception("Error adding book")
            raise MyException(e, sys)

    def __del__(self):
        try:
            try:
                self.cursor.close()
            except:
                pass
            disconnect_db()
        except:
            logging.error("Error occurred while closing DB connection")