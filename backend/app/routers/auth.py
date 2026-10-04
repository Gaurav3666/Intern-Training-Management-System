"""FR-AUTH (signup, login, mentor list) and FR-PROF (own profile)."""
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginIn, ProfileIn, SignupIn
from ..security import (DUMMY_HASH, create_token, get_current_user,
                        hash_password, login_throttle, verify_password)
from ..services import user_out
from ..validation import Checker, FieldErrors

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/auth/signup", status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    c = Checker()
    name = c.text("name", body.name, "Name", min_len=2, max_len=60)

    email = (body.email or "").strip().lower()
    if not email:
        c.add("email", "Email is required")
    elif not EMAIL_RE.match(email) or len(email) > 254:
        c.add("email", "Enter a valid email address, like name@example.com")

    password = body.password or ""
    if not password:
        c.add("password", "Password is required")
    elif (len(password) < 8 or not re.search(r"[A-Za-z]", password)
          or not re.search(r"\d", password)):
        c.add("password", "Use at least 8 characters with at least 1 letter and 1 number")
    elif len(password.encode()) > 72:
        c.add("password", "Password must be at most 72 characters")

    if not body.confirm_password:
        c.add("confirm_password", "Confirm your password")
    elif body.confirm_password != password:
        c.add("confirm_password", "Passwords do not match")

    if body.role not in ("intern", "mentor"):
        c.add("role", "Choose a role")

    domain = batch = None
    if body.role == "intern":
        if body.mentor_id is None:
            c.add("mentor_id", "Select a mentor")
        else:
            mentor = db.get(User, body.mentor_id)
            if mentor is None or mentor.role != "mentor":
                c.add("mentor_id", "Select a mentor from the list")
        domain = c.text("domain", body.domain, "Domain", min_len=2, max_len=60)
        batch = c.text("batch", body.batch, "Batch", min_len=2, max_len=60)
        if body.start_date is None:
            c.add("start_date", "Start date is required")
        if body.end_date is None:
            c.add("end_date", "End date is required")
        elif body.start_date is not None and body.start_date >= body.end_date:
            c.add("end_date", "End date must be after the start date")
    c.done()

    if db.query(User).filter(User.email == email).first():
        raise FieldErrors({"email": "An account with this email already exists"}, 409)

    is_intern = body.role == "intern"
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=body.role,
        mentor_id=body.mentor_id if is_intern else None,
        domain=domain,
        batch=batch,
        start_date=body.start_date if is_intern else None,
        end_date=body.end_date if is_intern else None,
    )
    db.add(user)
    db.commit()
    return user_out(db, user)


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = (body.email or "").strip().lower()
    password = body.password or ""
    c = Checker()
    if not email:
        c.add("email", "Email is required")
    if not password:
        c.add("password", "Password is required")
    c.done()

    if login_throttle.is_blocked(email):
        raise HTTPException(429, "Too many attempts. Try again later.")

    user = db.query(User).filter(User.email == email).first()
    valid = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if user is None or not valid:
        login_throttle.record_failure(email)
        raise HTTPException(401, "Invalid email or password")

    login_throttle.reset(email)
    return {"token": create_token(user), "role": user.role, "name": user.name}


@router.get("/mentors")
def list_mentors(db: Session = Depends(get_db)):
    mentors = db.query(User).filter(User.role == "mentor").order_by(User.name).all()
    return [{"id": m.id, "name": m.name} for m in mentors]


@router.get("/me")
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_out(db, user)


@router.put("/me")
def update_me(body: ProfileIn, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    c = Checker()
    name = c.text("name", body.name, "Name", min_len=2, max_len=60)
    domain = batch = None
    if user.role == "intern":
        domain = c.text("domain", body.domain, "Domain", min_len=2, max_len=60)
        batch = c.text("batch", body.batch, "Batch", min_len=2, max_len=60)
    c.done()

    user.name = name
    if user.role == "intern":
        user.domain, user.batch = domain, batch
    db.commit()
    return user_out(db, user)
