"""FR-PRG: progress for interns and the mentor's view of their own interns."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Submission, User
from ..security import require_intern, require_mentor
from ..services import (PENDING, get_own_intern, intern_progress,
                        own_intern_ids, user_out)

router = APIRouter()


def interns_with_progress(db: Session, mentor: User) -> list[dict]:
    interns = db.query(User).filter(User.mentor_id == mentor.id).order_by(User.name).all()
    return [{**user_out(db, intern), **intern_progress(db, intern)} for intern in interns]


@router.get("/interns")
def list_interns(mentor: User = Depends(require_mentor), db: Session = Depends(get_db)):
    return interns_with_progress(db, mentor)


@router.get("/interns/{intern_id}")
def get_intern(intern_id: int, mentor: User = Depends(require_mentor),
               db: Session = Depends(get_db)):
    intern = get_own_intern(db, mentor, intern_id)
    return {"profile": user_out(db, intern), "progress": intern_progress(db, intern)}


@router.get("/progress/me")
def my_progress(intern: User = Depends(require_intern), db: Session = Depends(get_db)):
    return intern_progress(db, intern)


@router.get("/progress/summary")
def progress_summary(mentor: User = Depends(require_mentor), db: Session = Depends(get_db)):
    pending = (
        db.query(Submission)
        .filter(Submission.user_id.in_(own_intern_ids(db, mentor)), Submission.status == PENDING)
        .count()
    )
    return {"pending_reviews": pending, "interns": interns_with_progress(db, mentor)}
