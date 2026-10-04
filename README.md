# Intern Training Management System

**InternPath** is a role-based web application for managing intern training, assignments, submissions, progress, and daily work logs.

The application has a **FastAPI backend**, **SQLite database**, and **HTML/CSS/JavaScript frontend** served by the FastAPI application.

---

## Features

### Authentication

- Intern and mentor signup
- User login
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Protected API endpoints
- Login throttling after repeated failed attempts
- Profile viewing and updating

### Mentor

- View assigned interns
- View individual intern profiles
- Monitor intern progress
- Create training modules
- Update and delete modules created by the mentor
- Create and update assignments
- View intern submissions
- Review submissions
- Mark submissions as `Reviewed`
- Request `Needs Rework`
- Provide feedback for rework
- View intern daily logs
- View training progress summary

### Intern

- View training modules
- Update module progress
- View assignments and deadlines
- Open individual assignment details
- Submit assignments
- Resubmit assignments when rework is requested
- View submission status and feedback
- View personal progress
- Create daily work logs
- Edit eligible daily logs
- View personal profile

---

## Tech Stack

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- JWT
- bcrypt
- Uvicorn

### Database

- SQLite

### Frontend

- HTML5
- CSS3
- JavaScript
- Chart.js

---

## Project Structure

```text
Intern-Training-Management/
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── assignments.py
│   │   │   ├── auth.py
│   │   │   ├── logs.py
│   │   │   ├── modules.py
│   │   │   ├── progress.py
│   │   │   └── submissions.py
│   │   │
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── services.py
│   │   └── validation.py
│   │
│   ├── itms.db
│   ├── requirements.txt
│   └── seed.py
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── intern.html
│   ├── intern-dashboard.html
│   ├── mentor-dashboard.html
│   ├── modules.html
│   ├── assignments.html
│   ├── assignment.html
│   ├── reviews.html
│   ├── logs.html
│   ├── profile.html
│   │
│   ├── css/
│   │   └── styles.css
│   │
│   └── js/
│       ├── app.js
│       ├── login.js
│       ├── signup.js
│       ├── intern.js
│       ├── intern-dashboard.js
│       ├── mentor-dashboard.js
│       ├── modules.js
│       ├── assignments.js
│       ├── assignment.js
│       ├── reviews.js
│       ├── logs.js
│       └── profile.js
│
├── .gitignore
└── README.md
```

---

# Backend

The backend is built with FastAPI and follows a router-based structure.

### `app/main.py`

Creates the FastAPI application, configures CORS and error handlers, registers all API routers, and serves the frontend as static files.

### `app/database.py`

Contains the SQLAlchemy database configuration, SQLite database URL, engine, session factory, and database dependency.

### `app/models.py`

Contains the SQLAlchemy models used by the application.

### `app/schemas.py`

Contains Pydantic schemas used for request validation.

### `app/security.py`

Handles:

- Password hashing
- Password verification
- JWT creation
- JWT validation
- Current-user authentication
- Mentor authorization
- Intern authorization
- Login throttling

### `app/services.py`

Contains shared application logic including:

- User response formatting
- Submission formatting
- Daily log formatting
- Progress calculations
- Mentor/intern access checks
- Date helpers
- Assignment status helpers

### `app/validation.py`

Contains reusable server-side validation and field error handling.

---

# Database

The project uses **SQLite** with **SQLAlchemy**.

The database file is:

```text
backend/itms.db
```

The main entities are:

```text
User
 │
 ├── Mentor
 │     └── Interns
 │
 ├── Modules
 │     └── Assignments
 │             └── Submissions
 │
 ├── Module Progress
 │
 └── Daily Logs
```

### User

Stores both mentors and interns.

Intern records can contain:

- Name
- Email
- Role
- Mentor
- Domain
- Batch
- Internship start date
- Internship end date

### Module

Stores training modules created by mentors.

### Module Progress

Stores the progress of an intern for a module.

Supported statuses:

```text
Not Started
In Progress
Completed
```

### Assignment

Stores tasks assigned within training modules.

### Submission

Stores intern assignment submissions and mentor reviews.

Supported statuses:

```text
Pending
Reviewed
Needs Rework
```

### Daily Log

Stores an intern's daily work information including:

- Date
- Description
- Hours
- Blockers

---

# API Endpoints

## Authentication

```text
POST /auth/signup
POST /auth/login
GET  /mentors
GET  /me
PUT  /me
```

### Signup

Creates a new user account.

Intern signup supports selecting a mentor.

### Login

Authenticates a user and returns a JWT token.

The token is used for protected API requests.

---

## Modules

```text
GET    /modules
POST   /modules
PUT    /modules/{module_id}
DELETE /modules/{module_id}
PUT    /modules/{module_id}/progress
```

### Mentor

Mentors can create, update, and delete modules they own.

### Intern

Interns can view modules and update their own module progress.

---

## Assignments

```text
GET /assignments
GET /assignments/{assignment_id}
POST /assignments
PUT /assignments/{assignment_id}
```

Assignments contain:

- Module
- Title
- Description
- Due date
- Creator

Assignments can also be filtered by module and status.

---

## Submissions

```text
POST /submissions
PUT  /submissions/{submission_id}
GET  /submissions
PUT  /submissions/{submission_id}/review
```

### Intern

An intern can:

- Submit an assignment
- Resubmit an assignment when rework is requested
- View their submissions

### Mentor

A mentor can:

- View submissions from assigned interns
- Review submissions
- Mark submissions as reviewed
- Request rework
- Provide feedback

When `Needs Rework` is selected, feedback is required.

---

## Progress

```text
GET /interns
GET /interns/{intern_id}
GET /progress/me
GET /progress/summary
```

### Intern

`/progress/me` returns the logged-in intern's progress.

### Mentor

Mentors can view their assigned interns and their progress.

The mentor progress summary also reports pending submission reviews.

---

## Daily Logs

```text
POST /logs
PUT  /logs/{log_id}
GET  /logs
```

Interns can create daily work logs.

A log includes:

- Date
- Work description
- Hours
- Blockers

The backend validates that:

- The date is not in the future
- The date falls within the internship period
- An intern cannot create two logs for the same date
- Hours are between 0.5 and 12
- Hours use 0.5-hour increments
- A log can only be edited on the day it was created

Mentors can view logs belonging to their assigned interns.

---

# Authentication & Security

The application uses JWT bearer authentication.

After login, the frontend stores the authentication token and sends it with protected API requests.

Protected requests use:

```text
Authorization: Bearer <token>
```

Passwords are hashed using bcrypt.

The application also has role-specific dependencies:

```text
require_intern
require_mentor
```

This prevents users from accessing functionality belonging to another role.

---

## Login Throttling

The application protects login attempts against repeated failures.

The current implementation blocks an email after:

```text
5 failed attempts
```

The block lasts:

```text
5 minutes
```

---

# Progress Calculation

The system tracks both module progress and assignment progress.

### Module Progress

```text
Completed Modules
----------------- × 100
Total Modules
```

### Assignment Progress

```text
Reviewed Assignments
-------------------- × 100
Total Assignments
```

### Overall Progress

```text
Module Progress + Assignment Progress
--------------------------------------
                  2
```

---

# Assignment Workflow

```text
Mentor creates assignment
          ↓
Intern views assignment
          ↓
Intern submits work
          ↓
       Pending
          ↓
Mentor reviews
       /       \
      /         \
Reviewed    Needs Rework
                ↓
        Intern resubmits
                ↓
             Pending
```

---

# Module Progress Workflow

```text
Not Started
     ↓
In Progress
     ↓
Completed
```

The backend validates module progress transitions.

Adding new assignment work to a completed module can reopen its progress to `In Progress`.

---

# Frontend

The frontend is served by FastAPI from the `frontend/` directory.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Main entry page |
| `login.html` | User login |
| `signup.html` | Account creation |
| `intern.html` | Intern view |
| `intern-dashboard.html` | Intern dashboard |
| `mentor-dashboard.html` | Mentor dashboard |
| `modules.html` | Training modules |
| `assignments.html` | Assignment listing |
| `assignment.html` | Assignment details and submission |
| `reviews.html` | Mentor submission reviews |
| `logs.html` | Daily work logs |
| `profile.html` | User profile |

### JavaScript Modules

```text
app.js
login.js
signup.js
intern.js
intern-dashboard.js
mentor-dashboard.js
modules.js
assignments.js
assignment.js
reviews.js
logs.js
profile.js
```

### Styling

The main stylesheet is:

```text
frontend/css/styles.css
```

### Charts

The mentor dashboard uses **Chart.js** for dashboard visualizations.

---

# CORS

The backend supports separate frontend development servers through the `FRONTEND_ORIGINS` environment variable.

The default allowed origins include:

```text
http://127.0.0.1:5500
http://localhost:5500
http://127.0.0.1:3000
http://localhost:3000
```

When the frontend is served directly by FastAPI from the same application, CORS is generally not required.

---

# Installation

## 1. Clone the repository

```bash
git clone <repository-url>
cd Intern-Training-Management
```

## 2. Create a virtual environment

```bash
python -m venv venv
```

## 3. Activate the virtual environment

### Windows

```bash
venv\Scripts\activate
```

If PowerShell blocks script execution:

```bash
venv\Scripts\activate.bat
```

## 4. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

# Seed Demo Data

From the `backend` directory:

```bash
python seed.py
```

The seed script creates:

- 1 mentor
- 3 interns
- 3 modules
- 6 assignments
- Sample submissions
- Sample module progress
- Sample daily logs

The script is safe to run again. If users already exist, it does not create duplicate demo users.

---

# Demo Accounts

All seeded demo accounts use:

```text
Password: Demo1234
```

### Mentor

```text
Email: mentor@demo.com
Name: Priya Sharma
```

### Intern

```text
Email: aarav@demo.com
Name: Aarav Mehta
Domain: Frontend
```

```text
Email: sara@demo.com
Name: Sara Khan
Domain: Backend
```

```text
Email: rohan@demo.com
Name: Rohan Verma
Domain: Data
```

These credentials are intended for local development and demonstration only.

---

# Run the Application

From the `backend` directory:

```bash
uvicorn app.main:app --reload
```

The application runs on:

```text
http://127.0.0.1:8000
```

Because the FastAPI application serves the `frontend/` directory, you can open:

```text
http://127.0.0.1:8000
```

For example, the login page is available at:

```text
http://127.0.0.1:8000/login.html
```

---

# API Documentation

FastAPI automatically provides interactive API documentation.

### Swagger UI

```text
http://127.0.0.1:8000/docs
```

### ReDoc

```text
http://127.0.0.1:8000/redoc
```

Swagger UI can be used to test the backend API directly.

---

# Requirements

The backend dependencies are defined in:

```text
backend/requirements.txt
```

Current dependencies:

```text
fastapi>=0.115
uvicorn[standard]>=0.30
sqlalchemy>=2.0
bcrypt>=4.1
pyjwt>=2.8
```

---

# Environment Configuration

The application supports the following environment variables.

### `SECRET_KEY`

Used for JWT signing.

If it is not provided, the application generates/uses a local secret key.

For production, use a secure environment variable rather than a development secret.

### `FRONTEND_ORIGINS`

Used to configure allowed frontend origins for CORS.

Example:

```text
FRONTEND_ORIGINS=http://localhost:5500,http://localhost:3000
```

---

# Validation

The backend performs server-side validation for important user input.

Examples include:

- Required fields
- Email validation
- Password validation
- Text length limits
- Internship date validation
- Module validation
- Assignment due-date validation
- Submission validation
- Submission link validation
- Module progress validation
- Daily log validation
- Duplicate daily logs
- Ownership checks
- Mentor/intern access checks

This ensures that validation is enforced even when requests are sent directly to the API instead of through the frontend.

---

# Error Handling

The FastAPI application includes custom handling for:

- Field validation errors
- Invalid request data
- Invalid dates
- Invalid numeric values

Validation errors are returned in a structured format containing a general `detail` message and field-specific errors.

---

# Application Flow

```text
                 ┌────────────────────┐
                 │      Frontend       │
                 │ HTML/CSS/JavaScript │
                 └─────────┬──────────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │      FastAPI       │
                 │      Routers       │
                 └─────────┬──────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
       Authentication   Validation   Authorization
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                 ┌────────────────────┐
                 │ Business Services  │
                 └─────────┬──────────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │     SQLAlchemy     │
                 └─────────┬──────────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │       SQLite       │
                 │      itms.db       │
                 └────────────────────┘
```

---

# Security Notes

Do not commit real production credentials or secrets to a public repository.

The local `.secret_key` file should be treated as sensitive.

For production deployment:

- Use environment variables for secrets
- Use a production database
- Configure secure CORS origins
- Use HTTPS
- Change all demo passwords
- Disable development settings where appropriate

Loom Video - https://drive.google.com/file/d/15KGfzFoU5Our16rErL9BpYPxDPhVK3LH/view?usp=drivesdk
---

# Future Improvements

Possible future improvements include:

- PostgreSQL/MySQL support
- Assignment
