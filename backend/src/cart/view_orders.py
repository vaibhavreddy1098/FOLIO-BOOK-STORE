from src.data_connection.connection import connect_db, disconnect_db
from src.logger import logging
from src.exception import MyException


class ViewOrders:
    def __init__(self):
        self.conn = connect_db()
        self.cursor = self.conn.cursor()

    # ================== VIEW ORDERS ==================
    def view_orders(self, user_id: int) -> list:
        try:
            # Get all orders with order total
            self.cursor.execute("""
                SELECT
                    o.order_id,
                    o.status,
                    o.created_at,
                    COALESCE(SUM(oi.quantity * b.price), 0) AS order_total
                FROM orders o
                LEFT JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN books b ON oi.book_id = b.book_id
                WHERE o.student_id = %s
                GROUP BY o.order_id, o.status, o.created_at
                ORDER BY o.created_at DESC
            """, (user_id,))

            orders = self.cursor.fetchall()
            result = []

            for order_id, status, created_at, order_total in orders:
                # Get items for this order
                self.cursor.execute("""
                    SELECT
                        b.title,
                        b.isbn,
                        oi.quantity,
                        b.price
                    FROM order_items oi
                    JOIN books b ON oi.book_id = b.book_id
                    WHERE oi.order_id = %s
                """, (order_id,))

                items = self.cursor.fetchall()

                item_list = []
                for title, isbn, quantity, price in items:
                    item_list.append({
                        "title": title,
                        "isbn": isbn,
                        "quantity": quantity,
                        "price": float(price)
                    })

                result.append({
                    "order_id": order_id,
                    "status": status,
                    "created_at": created_at,
                    "order_total": float(order_total),
                    "items": item_list
                })

            return result

        except Exception as e:
            logging.error(f"Error viewing orders for user_id {user_id}: {str(e)}")
            raise MyException("Error viewing orders", e)        
    def __del__(self):
        try:
            disconnect_db()
        except:
            logging.error("Error occurred while closing DB connection")

