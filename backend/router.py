from fastapi import APIRouter, Request, Depends, HTTPException, status, Body
from authentication.register import RegisterManager
from authentication.login import LoginManager
from src.artifacts.entities import student, order_desc  # FIXED: Combined imports
from src.search_books.by_author_or_name import BookSearch
from src.cart.order import OrderManager
from src.cart.add_to_cart import CartManager
from authentication.jwt import verify_token 
from src.cart.view_cart import CartView
from src.cart.view_orders import ViewOrders
from src.base_model import LoginRequest
from authentication.dependencies import admin_only, student_only, support_only, super_admin_only
from src.artifacts.entities import TicketCreate
from src.managers.ticket_manager import TicketManager
from src.data_connection.connection import connect_db, disconnect_db
from authentication.dependencies import admin_only
from src.managers.book_manager import BookADD
from src.artifacts.entities import book_new
from pydantic import BaseModel
import bcrypt
router = APIRouter()

# ================= NEW: AUTH DEPENDENCY =================
# This replaces the repetitive token extraction in every route
async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Missing or invalid Authorization header"
        )
    try:
        token = auth_header.split(" ")[1]
        payload = verify_token(token)
        return payload["user_id"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid token"
        )

# ================= REGISTER =================
@router.post("/register")
async def register_user(data: dict ):
    register_manager = RegisterManager()
    try:
        email = data["email"]
        password = data["password"]
        # FIXED: Added .get() to prevent KeyErrors if student_info is missing
        student_info = student(**data.get("student_info", {}))
        token = register_manager.register(email, password, student_info)
        return {"access_token": token}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) # CHANGED: Proper HTTP error

# ================= LOGIN =================
@router.post("/login")
async def login_user(data: LoginRequest):
    login_manager = LoginManager()
    try:
        result = login_manager.login(data.email, data.password)
        return result
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e)) # CHANGED: 401 for Login fail

# ================= SEARCH BOOKS =================

@router.get("/search_books")
async def search_books(q: str = None, author: str = None, name: str = None):
    book_search = BookSearch()
    try:
        query = q or name or author   # ✅ FIX
        books = book_search.search(query=query)
        print("SEARCH RESULT:", books)
        return books 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================= ADD TO CART =================
# CHANGED: Added Depends(get_current_user)
@router.post("/add_to_cart")
async def add_to_cart(book_id: int, quantity: int = 1, user_id: int = Depends(get_current_user)):
    cart_manager = CartManager()
    try:
        result = cart_manager.add_to_cart(
            user_id=user_id,
            book_id=book_id,
            quantity=quantity
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.post("/remove_from_cart")
def remove_item_from_cart(request: Request, book_id: int):
    """
    Removes a book from the student's cart.
    Accepts book_id as a query parameter from the URL.
    """
    # 1. Identify the logged-in student
    user_data = student_only(request)
    current_student_id = user_data["user_id"]
    
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # 2. Retrieve the cart_id belonging to this student
        find_cart_query = "SELECT cart_id FROM cart WHERE student_id = %s"
        db_cursor.execute(find_cart_query, (current_student_id,))
        cart_result = db_cursor.fetchone()
        
        if not cart_result:
            raise HTTPException(status_code=404, detail="Shopping cart not found")
            
        active_cart_id = cart_result[0]
        
        # 3. Delete the specific book from the cart_items table
        delete_item_query = "DELETE FROM cart_items WHERE cart_id = %s AND book_id = %s"
        db_cursor.execute(delete_item_query, (active_cart_id, book_id))
        
        db_connection.commit()
        
        return {
            "status": "success", 
            "message": f"Book ID {book_id} removed from your selection."
        }
        
    except Exception as database_error:
        db_connection.rollback()
        print(f"❌ DATABASE ERROR: {database_error}")
        raise HTTPException(status_code=500, detail="Internal server error during removal")
        
    finally:
        db_cursor.close()

# ================= EXECUTE ORDER =================
# CHANGED: Added Depends(get_current_user)
@router.post("/execute_order")
async def execute_order(
    cart_id: int,
    user_id: int = Depends(get_current_user)
):
    try:
        order_description = order_desc(
            status='new',
            shipping_type='standard',
            card_type='CASH',
            card_last_four='0000'
        )

        order_manager = OrderManager()

        result = order_manager.execute_full_order(
            user_id=user_id,
            cart_id=cart_id,
            order_info=order_description
        )

        return {"result": result}

    except Exception as e:
        print("ORDER ERROR:", str(e))
        raise HTTPException(status_code=400, detail=str(e))
# ================= VIEW CART =================
@router.get("/view_cart")
async def view_cart(user_id: int = Depends(get_current_user)):
    cart_view = CartView()
    try:
        cart_items = cart_view.view_cart(user_id)
        return {"cart_items": cart_items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================= VIEW ORDERS =================
@router.get("/view_orders")
async def view_orders_endpoint(user_id: int = Depends(get_current_user)):
    orders_service = ViewOrders() # CHANGED: Renamed variable to avoid class conflict
    try:
        orders = orders_service.view_orders(user_id)
        return {"orders": orders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    # ================= CREATE TICKETS =================
@router.post("/ticket/create")
def create_ticket(request: Request, ticket: TicketCreate):
    user = student_only(request)
    print("TOKEN PAYLOAD:", user)  # ← add this, check terminal
    manager = TicketManager()
    user_id = user.get("user_id") or user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id not found in token")
    return manager.create_ticket(user_id, ticket.category, ticket.title, ticket.description)
@router.get("/all_books")
def get_all_books():
    try:
        db_conn = connect_db()
        db_cursor = db_conn.cursor()
        
        # Aggregating ratings and review counts per book
        query = """
            SELECT b.book_id, b.title, b.publisher, b.price, b.quantity,
                   b.type, b.purchase_option, b.format, b.language, b.edition, b.category,
                   IFNULL(AVG(r.rating), 0) AS avg_rating, 
                   COUNT(r.review_id) AS review_count
            FROM books b
            LEFT JOIN reviews r ON b.book_id = r.book_id
            GROUP BY b.book_id
        """
        db_cursor.execute(query)
        book_rows = db_cursor.fetchall()
        db_cursor.close()

        return [
            {
                "book_id": row[0], 
                "title": row[1], 
                "author": row[2], # Using publisher column as author for now
                "price": float(row[3]), 
                "quantity": row[4], 
                "type": row[5],
                "purchase_option": row[6], 
                "format": row[7], 
                "language": row[8],
                "edition": row[9], 
                "category": row[10],
                "rating": round(float(row[11]), 1),
                "review_count": row[12]
            }
            for row in book_rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
  
    

@router.post("/admin/add-book")
def add_book(request: Request, book: book_new):
    user = admin_only(request)   # 🔐 important
    manager = BookADD()
    book_id = manager.add_book(user["user_id"], book)
    return {"book_id": book_id}
@router.get("/admin/assigned-tickets")
def get_assigned_tickets(request: Request):
    user = admin_only(request)

    conn = connect_db()
    cursor = conn.cursor()

    # Changed WHERE clause to include 'in_progress' tickets
    cursor.execute("""
        SELECT t.ticket_id, t.title, t.description, t.status, t.category, u.email
        FROM tickets t
        JOIN users u ON t.created_by = u.user_id
        WHERE t.status IN ('assigned', 'in_progress')
    """)

    rows = cursor.fetchall()

    tickets = []
    for r in rows:
        tickets.append({
            "ticket_id": r[0],
            "title": r[1],
            "description": r[2],
            "status": r[3],
            "category": r[4],
            "created_by_name": r[5]
        })
        
    cursor.close()
    return tickets
class TicketReplyPayload(BaseModel):
    ticket_id: int
    reply_text: str
    new_status: str

@router.post("/admin/ticket/reply")
def admin_reply_to_ticket(request: Request, payload: TicketReplyPayload):
    # 1. Authenticate the admin
    admin_user = admin_only(request)
    
    # 2. Establish database connection
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # 3. Update the ticket (removed resolved_by to prevent employee foreign key crashes)
        update_query = """
            UPDATE tickets 
            SET reply = %s, status = %s
            WHERE ticket_id = %s
        """
        # 4. Execute and commit
        db_cursor.execute(update_query, (
            payload.reply_text, 
            payload.new_status, 
            payload.ticket_id
        ))
        db_connection.commit()
        return {"message": "Ticket successfully updated"}
        
    except Exception as error:
        db_connection.rollback()
        # Print the exact error to the terminal for easier debugging
        print(f"CRITICAL DB ERROR: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
        
    finally:
        db_cursor.close()
    ticket_id: int
    reply_text: str
    new_status: str

@router.post("/admin/ticket/reply")
def admin_reply_to_ticket(request: Request, payload: TicketReplyPayload):
    # Verify the user is an admin
    admin_user = admin_only(request)
    
    # Establish database connection
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # Update the ticket with the admin's reply and new status
        update_query = """
            UPDATE tickets 
            SET reply = %s, status = %s, resolved_by = %s
            WHERE ticket_id = %s
        """
        # Execute with safe parameterized variables
        db_cursor.execute(update_query, (
            payload.reply_text, 
            payload.new_status, 
            admin_user["user_id"], 
            payload.ticket_id
        ))
        db_connection.commit()
        return {"message": "Ticket successfully updated"}
    except Exception as error:
        db_connection.rollback()
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        db_cursor.close()

@router.get("/ticket/my-tickets")
def fetch_student_tickets(user_id: int = Depends(get_current_user)):
    # Establish database connection
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # Fetch all tickets created by this specific student
        select_query = """
            SELECT ticket_id, category, title, description, status, reply 
            FROM tickets 
            WHERE created_by = %s 
            ORDER BY created_at DESC
        """
        db_cursor.execute(select_query, (user_id,))
        fetched_rows = db_cursor.fetchall()
        
        # Format the database rows into a list of dictionaries
        student_tickets = []
        for row in fetched_rows:
            student_tickets.append({
                "ticket_id": row[0],
                "category": row[1],
                "title": row[2],
                "description": row[3],
                "status": row[4],
                "reply": row[5] or "No reply yet."
            })
        return student_tickets
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        db_cursor.close()

class SupportActionPayload(BaseModel):
    ticket_id: int
    action: str  # Will be 'resolve' or 'escalate'

@router.get("/support/new-tickets")
def get_new_tickets(request: Request):
    # 1. Verify support access
    support_user = support_only(request)
    
    # 2. Connect to database
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # 3. Fetch ONLY tickets with status 'new'
        fetch_query = """
            SELECT t.ticket_id, t.title, t.description, t.category, u.email, t.created_at
            FROM tickets t
            JOIN users u ON t.created_by = u.user_id
            WHERE t.status = 'new'
            ORDER BY t.created_at ASC
        """
        db_cursor.execute(fetch_query)
        fetched_rows = db_cursor.fetchall()
        
        # 4. Format the response
        new_tickets = []
        for row in fetched_rows:
            new_tickets.append({
                "ticket_id": row[0],
                "title": row[1],
                "description": row[2],
                "category": row[3],
                "student_email": row[4],
                "created_at": str(row[5])
            })
        return new_tickets
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        db_cursor.close()


@router.post("/support/ticket/action")
def process_support_ticket(request: Request, payload: SupportActionPayload):
    # 1. Verify support access
    support_user = support_only(request)
    support_emp_id = support_user["user_id"] # Must exist in employees table!
    
    # 2. Determine new status based on button clicked
    new_status = 'completed' if payload.action == 'resolve' else 'assigned'
    
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # 3. Update the ticket status and assign the employee who touched it
        update_query = """
            UPDATE tickets 
            SET status = %s, resolved_by = %s
            WHERE ticket_id = %s
        """
        db_cursor.execute(update_query, (new_status, support_emp_id, payload.ticket_id))
        db_connection.commit()
        return {"message": f"Ticket marked as {new_status}"}
    except Exception as error:
        db_connection.rollback()
        print(f"SUPPORT DB ERROR: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        db_cursor.close()

class StaffCreatePayload(BaseModel):
    email: str
    password: str
    role: str
    first_name: str
    last_name: str
    phone: str
    aadhaar: str
    gender: str
    salary: float

@router.get("/super/stats")
def get_system_stats(request: Request):
    # Verify super admin
    super_admin_user = super_admin_only(request)
    
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # Fetch counts from major tables
        db_cursor.execute("SELECT COUNT(*) FROM books")
        total_books = db_cursor.fetchone()[0]
        
        db_cursor.execute("SELECT COUNT(*) FROM students")
        total_students = db_cursor.fetchone()[0]
        
        db_cursor.execute("SELECT COUNT(*) FROM employees")
        total_employees = db_cursor.fetchone()[0]
        
        db_cursor.execute("SELECT COUNT(*) FROM tickets")
        total_tickets = db_cursor.fetchone()[0]
        
        return {
            "books": total_books,
            "students": total_students,
            "employees": total_employees,
            "tickets": total_tickets
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        db_cursor.close()

@router.post("/super/add-staff")
def add_new_staff(request: Request, payload: StaffCreatePayload):
    # Verify super admin
    super_admin_user = super_admin_only(request)
    
    # Validate role
    if payload.role not in ['admin', 'support']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'support'.")
        
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    try:
        # 🔐 1. Hash the password before it goes to the database
        password_bytes = payload.password.encode('utf-8')
        secure_salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, secure_salt).decode('utf-8')
        
        # 2. Insert into users table using the HASHED password
        insert_user_query = """
            INSERT INTO users (email, password, role) 
            VALUES (%s, %s, %s)
        """
        db_cursor.execute(insert_user_query, (payload.email, hashed_password, payload.role))
        
        # Get the newly created user_id
        new_emp_id = db_cursor.lastrowid
        
        # 3. Insert into the employees table
        insert_employee_query = """
            INSERT INTO employees (emp_id, first_name, last_name, gender, salary, aadhaar, phone)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        db_cursor.execute(insert_employee_query, (
            new_emp_id, payload.first_name, payload.last_name, 
            payload.gender, payload.salary, payload.aadhaar, payload.phone
        ))
        
        db_connection.commit()
        return {"message": f"Successfully created new {payload.role}: {payload.first_name} {payload.last_name}"}
        
    except Exception as error:
        db_connection.rollback()
        print(f"SUPER ADMIN DB ERROR: {str(error)}")
        raise HTTPException(status_code=500, detail="Failed to create staff. Email or Aadhaar might already exist.")
    finally:
        db_cursor.close()

class ReviewPayload(BaseModel):
    book_id: int
    rating: int
    comment: str

@router.post("/reviews/submit")
def submit_review(request: Request, payload: ReviewPayload):
    user = student_only(request)
    student_id = user["user_id"]
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Check if review already exists
        cursor.execute("SELECT review_id FROM reviews WHERE student_id = %s AND book_id = %s", 
                       (student_id, payload.book_id))
        existing = cursor.fetchone()
        
        if existing:
            # UPDATE existing review
            cursor.execute("""
                UPDATE reviews SET rating = %s, comment = %s 
                WHERE student_id = %s AND book_id = %s
            """, (payload.rating, payload.comment, student_id, payload.book_id))
        else:
            # INSERT new review
            cursor.execute("""
                INSERT INTO reviews (student_id, book_id, rating, comment) 
                VALUES (%s, %s, %s, %s)
            """, (student_id, payload.book_id, payload.rating, payload.comment))
            
        conn.commit()
        return {"message": "Review saved successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

# Route to fetch full details for a specific book by ID
@router.get("/book/{book_id}")
def get_single_book_details(book_id: int):
    try:
        connection = connect_db()
        cursor = connection.cursor()

        cursor.execute("SELECT * FROM books WHERE book_id = %s", (book_id,))
        book_data = cursor.fetchone()

        if not book_data:
            cursor.close()
            raise HTTPException(status_code=404, detail="Book not found in database")

        cursor.execute("""
            SELECT r.rating, r.comment, s.first_name, s.last_name
            FROM reviews r
            JOIN students s ON r.student_id = s.student_id
            WHERE r.book_id = %s
        """, (book_id,))
        reviews_raw = cursor.fetchall()
        cursor.close()

        return {
            "book_info": {
                "id"              : book_data[0],
                "title"           : book_data[1],
                "isbn"            : book_data[2],
                "publisher"       : book_data[3],
                "price"           : float(book_data[4]),
                "stock_quantity"  : book_data[5],
                "condition_type"  : book_data[6],
                "purchase_option" : book_data[7],
                "format"          : book_data[8],
                "language"        : book_data[9],
                "edition"         : book_data[10],
                "category"        : book_data[11]
            },
            "reviews_list": [
                {
                    "rating"       : row[0],
                    "comment"      : row[1],
                    "student_name" : f"{row[2]} {row[3]}"
                }
                for row in reviews_raw
            ]
        }

    except HTTPException:
        raise
    except Exception as error:
        print(f"Server Error: {error}")
        raise HTTPException(status_code=500, detail=str(error))
# --- FETCH ALL BOOK SUGGESTIONS FOR ADMIN ---
@router.get("/admin/book-suggestions")
def get_admin_book_suggestions(request: Request):
    """
    Fetches pending book suggestions by joining course_books, 
    courses, and universities. Corrects the 'university_name' error.
    """
    # Security check: Ensure user is an admin
    admin_only(request)

    db_connection = None
    try:
        db_connection = connect_db()
        db_cursor = db_connection.cursor()

        # UPDATED SQL: Using 'u.name' based on your terminal error logs
        sql_query = """
        SELECT
            COALESCE(u.name, 'Unknown University') AS university_label,
            COALESCE(c.course_name, 'Unknown Course') AS course_label,
            cb.book_name,
            cb.publisher,
            cb.isbn,
            cb.copies_needed,
            cb.type,
            cb.purchase_option,
            cb.format,
            cb.language,
            cb.edition,
            cb.category,
            cb.course_id
        FROM course_books cb
        LEFT JOIN courses c ON cb.course_id = c.course_id
        LEFT JOIN universities u ON c.university_id = u.university_id
        ORDER BY university_label, course_label
    """
        db_cursor.execute(sql_query)
        suggestion_records = db_cursor.fetchall()
        db_cursor.close()

        # Map rows to descriptive dictionary objects
        formatted_suggestions = []
        for row in suggestion_records:
            formatted_suggestions.append({
                "university": row[0],
                "course":     row[1],
                "title":      row[2],
                "publisher":  row[3],
                "isbn":       row[4],
                "needed":     row[5],
                "priority":   row[6],  # 'required' or 'recommended'
                "option":     row[7],  # 'rent' or 'buy'
                "format":     row[8],
                "lang":       row[9],
                "edition":    row[10],
                "category":   row[11],
                "course_id":  row[12]
            })

        return formatted_suggestions

    except Exception as server_error:
        print("--- CRITICAL ERROR: SUGGESTION FETCH FAILED ---")
        print(server_error)
        raise HTTPException(status_code=500, detail="Internal Database Error: Check terminal logs.")

    finally:
        if db_connection:
            db_connection.close()


# --- APPROVE SUGGESTION & REMOVE FROM LIST ---
@router.post("/admin/approve-suggestion")
def approve_and_transfer_suggestion(request: Request, book_payload: dict = Body(...)):
    """
    Moves a book from the suggestions table to the live catalog 
    and removes the suggestion entry upon success.
    """
    admin_only(request)

    db_connection = connect_db()
    db_cursor = db_connection.cursor()

    try:
        # Step 1: Insert into the main 'books' table
        insert_sql = """
            INSERT INTO books
            (title, isbn, publisher, price, quantity, type, purchase_option, format, language, edition, category)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        db_cursor.execute(insert_sql, (
            book_payload["title"],
            book_payload["isbn"],
            book_payload["publisher"],
            book_payload["price"],    # User-defined price from frontend
            book_payload["needed"],   # Initial stock from copies_needed
            "new",                    # Default status
            book_payload["option"],
            book_payload["format"],
            book_payload["lang"],
            book_payload["edition"],
            book_payload["category"]
        ))

        # Step 2: Delete from 'course_books' (suggestion cleanup)
        delete_sql = "DELETE FROM course_books WHERE course_id = %s AND book_name = %s"
        db_cursor.execute(delete_sql, (book_payload["course_id"], book_payload["title"]))

        db_connection.commit()
        return {"message": "Success: Book migrated to main catalog."}

    except Exception as transaction_error:
        db_connection.rollback()
        print(f"Migration Error: {transaction_error}")
        raise HTTPException(status_code=400, detail=f"Failed to migrate book: {str(transaction_error)}")

    finally:
        db_cursor.close()
        db_connection.close()