"""FR-ASG: assignments, with submission state and the overdue flag computed at read time."""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Assignment, Module, ModuleProgress, Submission, User
from ..schemas import AssignmentIn
from ..security import get_current_user, require_mentor
from ..services import (COMPLETED, IN_PROGRESS, NOT_SUBMITTED, PENDING,
                        is_overdue, own_intern_ids, submission_out, today)
from ..validation import Checker

router = APIRouter()


def assignment_items(db: Session, user: User, assignments: list[Assignment]) -> list[dict]:
    """Shape assignments for the viewer: own status for interns, counts for mentors."""
    if user.role == "intern":
        intern_ids = [user.id]
    else:
        intern_ids = own_intern_ids(db, user)

    by_assignment: dict[int, dict[int, Submission]] = defaultdict(dict)
    if intern_ids:
        for s in db.query(Submission).filter(Submission.user_id.in_(intern_ids)):
            by_assignment[s.assignment_id][s.user_id] = s

    items = []
    for a in assignments:
        subs = by_assignment.get(a.id, {})
        item = {
            "id": a.id,
            "module_id": a.module_id,
            "module_title": a.module.title,
            "title": a.title,
            "description": a.description,
            "due_date": a.due_date.isoformat(),
            "created_by": a.created_by,
        }
        if user.role == "intern":
            sub = subs.get(user.id)
            item.update(
                submission_status=sub.status if sub else NOT_SUBMITTED,
                is_overdue=is_overdue(a, sub),
                submission=submission_out(sub) if sub else None,
            )
        else:
            overdue_count = sum(1 for i in intern_ids if is_overdue(a, subs.get(i)))
            item.update(
                can_edit=a.created_by == user.id,
                intern_count=len(intern_ids),
                submission_count=len(subs),
                pending_count=sum(1 for s in subs.values() if s.status == PENDING),
                overdue_count=overdue_count,
                is_overdue=overdue_count > 0,
                statuses=sorted({s.status for s in subs.values()}),
            )
        items.append(item)
    return items


def matches_status(item: dict, status: str) -> bool:
    if status == "Overdue":
        return item["is_overdue"]
    if "submission_status" in item:  # intern view
        return item["submission_status"] == status
    if status == NOT_SUBMITTED:
        return item["submission_count"] < item["intern_count"]
    return status in item["statuses"]


@router.get("/assignments")
def list_assignments(module_id: int | None = None, status: str | None = None,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Assignment)
    if module_id is not None:
        query = query.filter(Assignment.module_id == module_id)
    items = assignment_items(db, user, query.order_by(Assignment.due_date, Assignment.id).all())
    if status:
        items = [item for item in items if matches_status(item, status)]
    return items


@router.get("/assignments/{assignment_id}")
def get_assignment(assignment_id: int, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise HTTPException(404, "Assignment not found")
    return assignment_items(db, user, [assignment])[0]


@router.post("/assignments", status_code=201)
def create_assignment(body: AssignmentIn, mentor: User = Depends(require_mentor),
                      db: Session = Depends(get_db)):
    c = Checker()
    if body.module_id is None:
        c.add("module_id", "Select a module")
    elif db.get(Module, body.module_id) is None:
        c.add("module_id", "Select a module from the list")
    title = c.text("title", body.title, "Title", min_len=3, max_len=100)
    description = c.text("description", body.description, "Description", max_len=2000)
    if body.due_date is None:
        c.add("due_date", "Due date is required")
    elif body.due_date < today():
        c.add("due_date", "Due date must be today or later")
    c.done()

    assignment = Assignment(module_id=body.module_id, title=title, description=description,
                            due_date=body.due_date, created_by=mentor.id)
    db.add(assignment)
    # FR-MOD-04: new work reopens the module for interns who had completed it.
    db.query(ModuleProgress).filter_by(module_id=body.module_id, status=COMPLETED).update(
        {"status": IN_PROGRESS}
    )
    db.commit()
    return assignment_items(db, mentor, [assignment])[0]


@router.put("/assignments/{assignment_id}")
def update_assignment(assignment_id: int, body: AssignmentIn,
                      mentor: User = Depends(require_mentor), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise HTTPException(404, "Assignment not found")
    if assignment.created_by != mentor.id:
        raise HTTPException(403, "You can only change assignments you created")

    c = Checker()
    title = c.text("title", body.title, "Title", min_len=3, max_len=100)
    description = c.text("description", body.description, "Description", max_len=2000)
    if body.due_date is None:
        c.add("due_date", "Due date is required")
    elif body.due_date != assignment.due_date and body.due_date <= today():
        c.add("due_date", "Due date can only be changed to a future date")
    c.done()

    assignment.title, assignment.description = title, description
    assignment.due_date = body.due_date
    db.commit()
    return assignment_items(db, mentor, [assignment])[0]
