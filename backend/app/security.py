"""Password hashing, JWT handling, role guards and the login throttle."""
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import BACKEND_DIR, get_db
from .models import User

TOKEN_HOURS = 24
ALGORITHM = "HS256"
MAX_FAILED_LOGINS = 5
BLOCK_SECONDS = 5 * 60


def _load_secret() -> str:
    """Use SECRET_KEY if set, otherwise a random key generated once per install."""
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    path = BACKEND_DIR / ".secret_key"
    if not path.exists():
        path.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return path.read_text(encoding="utf-8").strip()


SECRET_KEY = _load_secret()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:  # e.g. password longer than bcrypt's 72 byte limit
        return False


# Checked when the email is unknown so both failure paths take similar time.
DUMMY_HASH = hash_password("not-a-real-password-0")


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(401, "Not logged in")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Session expired. Please log in again.")
    if user is None:
        raise HTTPException(401, "Session expired. Please log in again.")
    return user


def require_role(role: str):
    def guard(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(403, f"Only {role}s can do this")
        return user
    return guard


require_intern = require_role("intern")
require_mentor = require_role("mentor")


class LoginThrottle:
    """5 failed attempts in a row for one email blocks it for 5 minutes."""

    def __init__(self):
        self._failures: dict[str, int] = {}
        self._blocked_until: dict[str, float] = {}

    def is_blocked(self, email: str) -> bool:
        until = self._blocked_until.get(email)
        if until is None:
            return False
        if time.monotonic() >= until:
            del self._blocked_until[email]
            return False
        return True

    def record_failure(self, email: str) -> None:
        count = self._failures.get(email, 0) + 1
        if count >= MAX_FAILED_LOGINS:
            self._failures.pop(email, None)
            self._blocked_until[email] = time.monotonic() + BLOCK_SECONDS
        else:
            self._failures[email] = count

    def reset(self, email: str) -> None:
        self._failures.pop(email, None)


login_throttle = LoginThrottle()
