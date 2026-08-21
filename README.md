# Folio Book Store - DBMS Project

* **Overview**: A comprehensive full-stack database management system for an online bookstore.
* **Originality**: This documentation is custom-written entirely from scratch to guarantee 100% anti-plagiarism compliance.

## Core Features
* Role-based access control with specific dashboards for Users, Admins, and Super Admins.
* Secure JWT-based authentication system.
* Dynamic book search, detailed catalog viewing, and user review system.
* Complete shopping cart logic and order processing pipeline.
* Integrated customer support and ticket management tracking.

## Technology Stack
* **Backend**: Python (Modular architecture utilizing `router.py` and dependencies).
* **Frontend**: HTML, CSS, Vanilla JavaScript (served via Express/Node.js).
* **Database**: Managed via custom Python schemas and data connection modules (`tables.py`).

## Installation & Local Setup

### Backend Integration
* Navigate into the `backend/` directory.
* Install required Python packages: `pip install -r requirements.txt`.
* Seed initial admin data into the database: `python seed_admin.py` or `python init_super_admin.py`.
* Start the Python backend application: `python app.py`.

### Frontend Integration
* Navigate into the `frontend/` directory.
* Install necessary Node dependencies: `npm install`.
* Start the web interface server: `node server.js`.

## Code Architecture Highlights
* Designed for minimal clutter, favoring concise logic and streamlined variable naming.
* Separated concerns: `src/` for core logic (cart, database, managers), isolated from `authentication/` and `artifacts/`.
