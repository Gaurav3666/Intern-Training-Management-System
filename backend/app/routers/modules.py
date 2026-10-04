"""FR-MOD: training modules and per-intern module status."""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Assignment, Module, ModuleProgress, Submission, User
from ..schemas import ModuleIn, ModuleProgressIn
from ..security import get_current_user, require_intern, require_mentor
from ..services import COMPLETED, IN_PROGRESS, NEEDS_REWORK, NOT_STARTED
from ..validation import Checker, FieldErrors

router = APIRouter()

STATUSES = (NOT_STARTED, IN_PROGRESS, COMPLETED)
ALLOWED_TRANSITIONS = {
    (NOT_STARTED, IN_PROGRESS),
    (IN_PROGRESS, COMPLETED),
    (IN_PROGRESS, NOT_STARTED),
}


def module_out(db: Session, module: Module, user: User, status: str | None = None) -> dict:
    out = {
        "id": module.id,
        "title": module.title,
        "description": module.description,
        "order_no": module.order_no,
        "created_by": module.created_by,
        "assignment_count": db.query(Assignment).filter_by(module_id=module.id).count(),
    }
    if user.role == "intern":
        out["status"] = status or NOT_STARTED
    else:
        out["can_edit"] = module.created_by == user.id
    return out


def validate_module(body: ModuleIn, db: Session, current: Module | None = None) -> dict:
    c = Checker()
    title = c.text("title", body.title, "Title", min_len=3, max_len=100)
    description = c.text("description", body.description, "Description", max_len=1000)
    if body.order_no is None:
        c.add("order_no", "Order number is required")
    elif body.order_no < 1:
        c.add("order_no", "Order number must be a positive whole number")
    c.done()

    clash = db.query(Module).filter(Module.order_no == body.order_no).first()
    if clash and (current is None or clash.id != current.id):
        raise FieldErrors({"order_no": "Order number already used"}, 409)
    return {"title": title, "description": description, "order_no": body.order_no}


def get_own_module(db: Session, module_id: int, mentor: User) -> Module:
    module = db.get(Module, module_id)
    if module is None:
        raise HTTPException(404, "Module not found")
    if module.created_by != mentor.id:
        raise HTTPException(403, "You can only change modules you created")
    return module


@router.get("/modules")
def list_modules(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    modules = db.query(Module).order_by(Module.order_no).all()
    statuses = {}
    if user.role == "intern":
        statuses = {
            p.module_id: p.status
            for p in db.query(ModuleProgress).filter_by(user_id=user.id)
        }
    return [module_out(db, m, user, statuses.get(m.id)) for m in modules]


@router.post("/modules", status_code=201)
def create_module(body: ModuleIn, mentor: User = Depends(require_mentor),
                  db: Session = Depends(get_db)):
    module = Module(**validate_module(body, db), created_by=mentor.id)
    db.add(module)
    db.commit()
    return module_out(db, module, mentor)


@router.put("/modules/{module_id}")
def update_module(module_id: int, body: ModuleIn, mentor: User = Depends(require_mentor),
                  db: Session = Depends(get_db)):
    module = get_own_module(db, module_id, mentor)
    for field, value in validate_module(body, db, current=module).items():
        setattr(module, field, value)
    db.commit()
    return module_out(db, module, mentor)


@router.delete("/modules/{module_id}", status_code=204)
def delete_module(module_id: int, mentor: User = Depends(require_mentor),
                  db: Session = Depends(get_db)):
    module = get_own_module(db, module_id, mentor)
    if db.query(Assignment).filter_by(module_id=module.id).first():
        raise HTTPException(400, "Remove its assignments first")
    db.query(ModuleProgress).filter_by(module_id=module.id).delete()
    db.delete(module)
    db.commit()
    return Response(status_code=204)


@router.put("/modules/{module_id}/progress")
def update_progress(module_id: int, body: ModuleProgressIn,
                    intern: User = Depends(require_intern), db: Session = Depends(get_db)):
    module = db.get(Module, module_id)
    if module is None:
        raise HTTPException(404, "Module not found")
    if body.status not in STATUSES:
        raise FieldErrors({"status": "Choose a valid status"})

    progress = db.query(ModuleProgress).filter_by(user_id=intern.id, module_id=module.id).first()
    current = progress.status if progress else NOT_STARTED

    if body.status != current:
        if (current, body.status) not in ALLOWED_TRANSITIONS:
            if current == COMPLETED:
                message = "A completed module cannot be changed"
            else:
                message = f"Move the module to {IN_PROGRESS} first"
            raise HTTPException(400, message)

        if body.status == COMPLETED:
            assignment_ids = [
                row[0] for row in db.query(Assignment.id).filter_by(module_id=module.id)
            ]
            submitted = (
                db.query(Submission)
                .filter(
                    Submission.user_id == intern.id,
                    Submission.assignment_id.in_(assignment_ids),
                    Submission.status != NEEDS_REWORK,
                )
                .count()
            )
            if submitted < len(assignment_ids):
                raise HTTPException(400, "Submit all assignments first")

        if progress is None:
            progress = ModuleProgress(user_id=intern.id, module_id=module.id)
            db.add(progress)
        progress.status = body.status
        db.commit()

    return {"module_id": module.id, "status": body.status}
