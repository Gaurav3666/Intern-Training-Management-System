"""Tables from FRD section 5. Datetimes are stored as naive UTC."""
from datetime import datetime, timezone

from sqlalchemy import (Boolean, Column, Date, DateTime, Float, ForeignKey,
                        Integer, Text, UniqueConstraint)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)  # always stored lowercase
    password_hash = Column(Text, nullable=False)
    role = Column(Text, nullable=False)  # "intern" or "mentor"
    mentor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    domain = Column(Text, nullable=True)
    batch = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    mentor = relationship("User", remote_side=[id])


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    order_no = Column(Integer, unique=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))


class ModuleProgress(Base):
    __tablename__ = "module_progress"
    __table_args__ = (UniqueConstraint("user_id", "module_id"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    status = Column(Text, default="Not Started", nullable=False)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    due_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))

    module = relationship("Module")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "user_id"),)

    id = Column(Integer, primary_key=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    response_text = Column(Text, nullable=False)
    link = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=False)
    is_late = Column(Boolean, nullable=False)
    status = Column(Text, nullable=False)  # Pending / Reviewed / Needs Rework
    feedback = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    assignment = relationship("Assignment")
    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class DailyLog(Base):
    __tablename__ = "daily_logs"
    __table_args__ = (UniqueConstraint("user_id", "log_date"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    hours = Column(Float, nullable=False)
    blockers = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User")
