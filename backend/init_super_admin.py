import bcrypt
from src.data_connection.connection import connect_db

def initialize_super_admin():
    # 1. Establish a connection to the database
    db_connection = connect_db()
    db_cursor = db_connection.cursor()
    
    # 2. Define the exact credentials for the master account
    admin_email = "master@folio.edu"
    raw_password = "supersecret123"
    
    # 3. Securely hash the password using bcrypt directly
    password_bytes = raw_password.encode('utf-8')
    secure_salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password_bytes, secure_salt).decode('utf-8')
    
    try:
        # 4. Insert the secure credentials into the users table
        insert_user_query = """
            INSERT INTO users (email, password, role) 
            VALUES (%s, %s, 'super_admin')
        """
        db_cursor.execute(insert_user_query, (admin_email, hashed_password))
        
        # 5. Capture the newly generated user_id for this admin
        super_admin_id = db_cursor.lastrowid
        
        # 6. Insert the corresponding profile into the employees table
        insert_employee_query = """
            INSERT INTO employees (emp_id, first_name, last_name, gender, salary, aadhaar, phone) 
            VALUES (%s, 'Master', 'Control', 'Other', 150000, '000011112222', '9998887776')
        """
        db_cursor.execute(insert_employee_query, (super_admin_id,))
        
        # 7. Commit the transaction to save changes to the database
        db_connection.commit()
        
        print("✅ SUCCESS! Master account provisioned securely.")
        print(f"Email: {admin_email}")
        print(f"User ID: {super_admin_id}")
        
    except Exception as database_error:
        # 8. Rollback any partial changes if an error occurs
        db_connection.rollback()
        print(f"❌ DATABASE ERROR: {database_error}")
        
    finally:
        # 9. Always close the cursor to free up resources
        db_cursor.close()

if __name__ == "__main__":
    print("Initializing Super Admin setup...")
    initialize_super_admin()