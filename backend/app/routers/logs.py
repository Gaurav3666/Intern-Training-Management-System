"""FR-LOG: daily work logs."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DailyLog, User
from ..schemas import LogIn
from ..security import get_current_user, require_intern
from ..services import (get_own_intern, log_editable, log_out, own_intern_ids,
                        today)
from ..validation import Checker, FieldErrors

router = APIRouter()


def validate_log_content(c: Checker, body: LogIn) -> dict:
    description = c.text("description", body.description, "Description",
                         min_len=10, max_len=1000)
    if body.hours is None:
        c.add("hours", "Hours is required")
    elif not 0.5 <= body.hours <= 12 or (body.hours * 2) % 1 != 0:
        c.add("hours", "Hours must be between 0.5 and 12, in steps of 0.5")
    blockers = c.text("blockers", body.blockers, "Blockers", max_len=500, required=False)
    return {"description": description, "hours": body.hours, "blockers": blockers}


@router.post("/logs", status_code=201)
def create_log(body: LogIn, intern: User = Depends(require_intern),
               db: Session = Depends(get_db)):
    c = Checker()
    if body.log_date is None:
        c.add("log_date", "Date is required")
    elif body.log_date > today():
        c.add("log_date", "Date cannot be in the future")
    elif ((intern.start_date and body.log_date < intern.start_date)
          or (intern.end_date and body.log_date > intern.end_date)):
        c.add("log_date", "Date must be within your internship dates")
    content = validate_log_content(c, body)
    c.done()

    if db.query(DailyLog).filter_by(user_id=intern.id, log_date=body.log_date).first():
        raise FieldErrors({"log_date": "Log already exists for this date"}, 409)

    log = DailyLog(user_id=intern.id, log_date=body.log_date, **content)
    db.add(log)
    db.commit()
    return log_out(log, intern)


@router.put("/logs/{log_id}")
def update_log(log_id: int, body: LogIn, intern: User = Depends(require_intern),
               db: Session = Depends(get_db)):
    log = db.get(DailyLog, log_id)
    if log is None or log.user_id != intern.id:
        raise HTTPException(404, "Log not found")
    if not log_editable(log):
        raise HTTPException(403, "A log can only be edited on the day it was created")

    c = Checker()
    content = validate_log_content(c, body)
    c.done()
    for field, value in content.items():
        setattr(log, field, value)
    db.commit()
    return log_out(log, intern)


@router.get("/logs")
def list_logs(intern_id: int | None = None,
              date_from: date | None = Query(None, alias="from"),
              date_to: date | None = Query(None, alias="to"),
              user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(DailyLog)
    if user.role == "intern":
        query = query.filter(DailyLog.user_id == user.id)
    elif intern_id is not None:
        query = query.filter(DailyLog.user_id == get_own_intern(db, user, intern_id).id)
    else:
        query = query.filter(DailyLog.user_id.in_(own_intern_ids(db, user)))

    if date_from:
        query = query.filter(DailyLog.log_date >= date_from)
    if date_to:
        query = query.filter(DailyLog.log_date <= date_to)

    logs = query.order_by(DailyLog.log_date.desc(), DailyLog.id.desc()).all()
    return [log_out(log, user) for log in logs]
