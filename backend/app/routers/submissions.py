"""FR-SUB: submit, resubmit, list and review."""
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Assignment, Submission, User, utcnow
from ..schemas import ReviewIn, SubmissionIn
from ..security import get_current_user, require_intern, require_mentor
from ..services import (NEEDS_REWORK, PENDING, REVIEWED, get_own_intern,
                        own_intern_ids, submission_out, today)
from ..validation import Checker, FieldErrors

router = APIRouter()


def validate_response(body: SubmissionIn) -> tuple[str, str | None]:
    c = Checker()
    text = c.text("response_text", body.response_text, "Response", min_len=10, max_len=3000)
    link = (body.link or "").strip() or None
    if link:
        parsed = urlparse(link)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or len(link) > 500:
            c.add("link", "Enter a valid link starting with http:// or https://")
    c.done()
    return text, link


@router.post("/submissions", status_code=201)
def submit(body: SubmissionIn, intern: User = Depends(require_intern),
           db: Session = Depends(get_db)):
    if body.assignment_id is None:
        raise FieldErrors({"assignment_id": "Assignment is required"})
    assignment = db.get(Assignment, body.assignment_id)
    if assignment is None:
        raise HTTPException(404, "Assignment not found")
    text, link = validate_response(body)

    if db.query(Submission).filter_by(assignment_id=assignment.id, user_id=intern.id).first():
        raise HTTPException(409, "You have already submitted this assignment")

    submission = Submission(
        assignment_id=assignment.id,
        user_id=intern.id,
        response_text=text,
        link=link,
        submitted_at=utcnow(),
        is_late=today() > assignment.due_date,
        status=PENDING,
    )
    db.add(submission)
    db.commit()
    return submission_out(submission)


@router.put("/submissions/{submission_id}")
def resubmit(submission_id: int, body: SubmissionIn, intern: User = Depends(require_intern),
             db: Session = Depends(get_db)):
    submission = db.get(Submission, submission_id)
    if submission is None or submission.user_id != intern.id:
        raise HTTPException(404, "Submission not found")
    if submission.status != NEEDS_REWORK:
        raise HTTPException(400, "You can resubmit only when rework is requested")
    text, link = validate_response(body)

    # Feedback is kept so the intern and mentor still see it as a history note.
    submission.response_text, submission.link = text, link
    submission.submitted_at = utcnow()
    submission.is_late = today() > submission.assignment.due_date
    submission.status = PENDING
    db.commit()
    return submission_out(submission)


@router.get("/submissions")
def list_submissions(intern_id: int | None = None, module_id: int | None = None,
                     assignment_id: int | None = None, status: str | None = None,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Submission).join(Assignment, Submission.assignment_id == Assignment.id)
    if user.role == "intern":
        query = query.filter(Submission.user_id == user.id)
    elif intern_id is not None:
        query = query.filter(Submission.user_id == get_own_intern(db, user, intern_id).id)
    else:
        query = query.filter(Submission.user_id.in_(own_intern_ids(db, user)))

    if module_id is not None:
        query = query.filter(Assignment.module_id == module_id)
    if assignment_id is not None:
        query = query.filter(Submission.assignment_id == assignment_id)
    if status:
        query = query.filter(Submission.status == status)

    rows = query.order_by(Submission.submitted_at.desc(), Submission.id.desc()).all()
    return [submission_out(s) for s in rows]


@router.put("/submissions/{submission_id}/review")
def review(submission_id: int, body: ReviewIn, mentor: User = Depends(require_mentor),
           db: Session = Depends(get_db)):
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(404, "Submission not found")
    if submission.user.mentor_id != mentor.id:
        raise HTTPException(403, "This intern is not assigned to you")

    c = Checker()
    if body.status not in (REVIEWED, NEEDS_REWORK):
        c.add("status", "Choose Reviewed or Needs Rework")
    feedback = c.text("feedback", body.feedback, "Feedback", max_len=1000, required=False)
    if body.status == NEEDS_REWORK and not feedback:
        c.add("feedback", "Feedback is required when you ask for rework")
    c.done()

    submission.status = body.status
    submission.feedback = feedback
    submission.reviewed_by = mentor.id
    submission.reviewed_at = utcnow()
    db.commit()
    return submission_out(submission)
