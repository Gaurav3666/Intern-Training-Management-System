"""Shared business rules: access scoping, overdue, progress, and JSON shapes."""
import math
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import (Assignment, DailyLog, Module, ModuleProgress, Submission,
                     User)

NOT_STARTED, IN_PROGRESS, COMPLETED = "Not Started", "In Progress", "Completed"
PENDING, REVIEWED, NEEDS_REWORK = "Pending", "Reviewed", "Needs Rework"
NOT_SUBMITTED = "Not Submitted"


def today() -> date:
    # Single time zone for the demo (FRD section 11): the server's local date.
    return date.today()


def iso(dt: datetime | None) -> str | None:
    """Naive UTC datetime -> ISO string the browser converts to local time."""
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


def local_date(dt: datetime) -> date:
    return dt.replace(tzinfo=timezone.utc).astimezone().date()


# ---------- access scoping ----------

def own_intern_ids(db: Session, mentor: User) -> list[int]:
    return [row[0] for row in db.query(User.id).filter(User.mentor_id == mentor.id)]


def get_own_intern(db: Session, mentor: User, intern_id: int) -> User:
    intern = db.get(User, intern_id)
    if intern is None or intern.role != "intern":
        raise HTTPException(404, "Intern not found")
    if intern.mentor_id != mentor.id:
        raise HTTPException(403, "This intern is not assigned to you")
    return intern


# ---------- rules ----------

def is_overdue(assignment: Assignment, submission: Submission | None) -> bool:
    """FR-ASG-04: past due with no submission, or rework requested and not resubmitted."""
    if today() <= assignment.due_date:
        return False
    return submission is None or submission.status == NEEDS_REWORK


def percent(part: int, total: int) -> float:
    return part / total * 100 if total else 0.0


def round_half_up(value: float) -> int:
    return math.floor(value + 0.5)


def intern_progress(db: Session, intern: User) -> dict:
    """FR-PRG-01 formulas plus the counts the dashboards show."""
    modules_total = db.query(Module).count()
    modules_completed = (
        db.query(ModuleProgress)
        .filter_by(user_id=intern.id, status=COMPLETED)
        .count()
    )
    assignments = db.query(Assignment).order_by(Assignment.due_date, Assignment.id).all()
    subs = {s.assignment_id: s for s in db.query(Submission).filter_by(user_id=intern.id)}

    reviewed = sum(1 for a in assignments if a.id in subs and subs[a.id].status == REVIEWED)
    overdue = sum(1 for a in assignments if is_overdue(a, subs.get(a.id)))
    upcoming = [
        a for a in assignments
        if a.due_date >= today() and (a.id not in subs or subs[a.id].status == NEEDS_REWORK)
    ][:3]

    last_log = (
        db.query(DailyLog.log_date)
        .filter_by(user_id=intern.id)
        .order_by(DailyLog.log_date.desc())
        .first()
    )
    log_today = (
        db.query(DailyLog).filter_by(user_id=intern.id, log_date=today()).first() is not None
    )

    module_pct = percent(modules_completed, modules_total)
    assignment_pct = percent(reviewed, len(assignments))
    return {
        "module_percent": round_half_up(module_pct),
        "assignment_percent": round_half_up(assignment_pct),
        "overall_percent": round_half_up((module_pct + assignment_pct) / 2),
        "modules_completed": modules_completed,
        "modules_total": modules_total,
        "assignments_reviewed": reviewed,
        "assignments_total": len(assignments),
        "overdue_count": overdue,
        "last_log_date": last_log[0].isoformat() if last_log else None,
        "log_today": log_today,
        "upcoming": [
            {
                "id": a.id,
                "title": a.title,
                "module_title": a.module.title,
                "due_date": a.due_date.isoformat(),
            }
            for a in upcoming
        ],
    }


# ---------- JSON shapes (password_hash is never included) ----------

def user_out(db: Session, user: User) -> dict:
    out = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": iso(user.created_at),
    }
    if user.role == "intern":
        out.update(
            mentor_id=user.mentor_id,
            mentor_name=user.mentor.name if user.mentor else None,
            domain=user.domain,
            batch=user.batch,
            start_date=user.start_date.isoformat() if user.start_date else None,
            end_date=user.end_date.isoformat() if user.end_date else None,
        )
    else:
        out["intern_count"] = db.query(User).filter(User.mentor_id == user.id).count()
    return out


def submission_out(s: Submission) -> dict:
    return {
        "id": s.id,
        "assignment_id": s.assignment_id,
        "assignment_title": s.assignment.title,
        "module_id": s.assignment.module_id,
        "module_title": s.assignment.module.title,
        "due_date": s.assignment.due_date.isoformat(),
        "intern_id": s.user_id,
        "intern_name": s.user.name,
        "response_text": s.response_text,
        "link": s.link,
        "submitted_at": iso(s.submitted_at),
        "is_late": s.is_late,
        "status": s.status,
        "feedback": s.feedback,
        "reviewed_by": s.reviewed_by,
        "reviewer_name": s.reviewer.name if s.reviewer else None,
        "reviewed_at": iso(s.reviewed_at),
    }


def log_editable(log: DailyLog) -> bool:
    """FR-LOG-02: editable only on the day it was created."""
    return local_date(log.created_at) == today()


def log_out(log: DailyLog, viewer: User) -> dict:
    return {
        "id": log.id,
        "intern_id": log.user_id,
        "intern_name": log.user.name,
        "log_date": log.log_date.isoformat(),
        "description": log.description,
        "hours": log.hours,
        "blockers": log.blockers,
        "has_blocker": bool(log.blockers),
        "created_at": iso(log.created_at),
        "can_edit": viewer.id == log.user_id and log_editable(log),
    }
