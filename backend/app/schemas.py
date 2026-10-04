"""Request bodies.

Types are deliberately loose (everything optional): the business validation
lives in the routers via validation.Checker so that error messages are
friendly and mapped to the field the user has to fix.
"""
from datetime import date

from pydantic import BaseModel


class SignupIn(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = None
    confirm_password: str | None = None
    role: str | None = None
    mentor_id: int | None = None
    domain: str | None = None
    batch: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class LoginIn(BaseModel):
    email: str | None = None
    password: str | None = None


class ProfileIn(BaseModel):
    name: str | None = None
    domain: str | None = None
    batch: str | None = None


class ModuleIn(BaseModel):
    title: str | None = None
    description: str | None = None
    order_no: int | None = None


class ModuleProgressIn(BaseModel):
    status: str | None = None


class AssignmentIn(BaseModel):
    module_id: int | None = None
    title: str | None = None
    description: str | None = None
    due_date: date | None = None


class SubmissionIn(BaseModel):
    assignment_id: int | None = None
    response_text: str | None = None
    link: str | None = None


class ReviewIn(BaseModel):
    status: str | None = None
    feedback: str | None = None


class LogIn(BaseModel):
    log_date: date | None = None
    description: str | None = None
    hours: float | None = None
    blockers: str | None = None
