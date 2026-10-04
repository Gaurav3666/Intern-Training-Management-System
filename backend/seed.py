"""Demo data: 1 mentor, 3 interns, 3 modules, 6 assignments (FRD section 11).

Run from the backend folder:  python seed.py
Safe to run again: it does nothing if users already exist.
All demo accounts use the password  Demo1234
"""
from datetime import timedelta

from app.database import Base, SessionLocal, engine
from app.models import (Assignment, DailyLog, Module, ModuleProgress,
                        Submission, User, utcnow)
from app.security import hash_password
from app.services import (COMPLETED, IN_PROGRESS, NEEDS_REWORK, PENDING,
                          REVIEWED, today)

PASSWORD = "Demo1234"


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    if db.query(User).first():
        print("Database already has users - nothing to seed.")
        return

    t = today()
    password_hash = hash_password(PASSWORD)

    mentor = User(name="Priya Sharma", email="mentor@demo.com",
                  password_hash=password_hash, role="mentor")
    db.add(mentor)
    db.flush()

    def intern(name, email, domain):
        user = User(name=name, email=email, password_hash=password_hash, role="intern",
                    mentor_id=mentor.id, domain=domain, batch="2026-B",
                    start_date=t - timedelta(days=30), end_date=t + timedelta(days=60))
        db.add(user)
        return user

    aarav = intern("Aarav Mehta", "aarav@demo.com", "Frontend")
    sara = intern("Sara Khan", "sara@demo.com", "Backend")
    rohan = intern("Rohan Verma", "rohan@demo.com", "Data")

    modules = [
        Module(order_no=1, title="Git and Collaboration", created_by=mentor.id,
               description="Branching, pull requests and code review etiquette."),
        Module(order_no=2, title="Web Fundamentals", created_by=mentor.id,
               description="Semantic HTML, modern CSS layout and accessible forms."),
        Module(order_no=3, title="APIs with FastAPI", created_by=mentor.id,
               description="Designing, building and testing a REST API."),
    ]
    db.add_all(modules)
    db.flush()

    plan = [  # (module index, title, description, due in days from today)
        (0, "Open your first pull request", "Fork the practice repo, fix one issue and open a PR.", -10),
        (0, "Resolve a merge conflict", "Rebase your branch on main and resolve the conflict.", -5),
        (1, "Build a semantic landing page", "One page using landmarks, headings and no div soup.", -2),
        (1, "Accessible signup form", "Labels, error messages and full keyboard support.", 3),
        (2, "Design a REST resource", "Write the endpoint table for a to-do API.", 7),
        (2, "Build and test the API", "Implement the to-do API with FastAPI and pytest.", 14),
    ]
    assignments = [
        Assignment(module_id=modules[m].id, title=title, description=desc,
                   due_date=t + timedelta(days=days), created_by=mentor.id)
        for m, title, desc, days in plan
    ]
    db.add_all(assignments)
    db.flush()

    now = utcnow()

    def submission(user, index, status, days_ago, feedback=None, late=False):
        reviewed = status != PENDING
        db.add(Submission(
            assignment_id=assignments[index].id, user_id=user.id,
            response_text="Completed the task as described. Notes and screenshots are in the linked repo.",
            link="https://github.com/example/practice-repo",
            submitted_at=now - timedelta(days=days_ago), is_late=late, status=status,
            feedback=feedback,
            reviewed_by=mentor.id if reviewed else None,
            reviewed_at=now - timedelta(days=max(days_ago - 1, 0)) if reviewed else None,
        ))

    submission(aarav, 0, REVIEWED, 12, "Clean PR with a clear description. Well done.")
    submission(aarav, 1, REVIEWED, 6, "Good conflict resolution.")
    submission(aarav, 2, PENDING, 3)
    submission(sara, 0, REVIEWED, 11, "Nice work.")
    submission(sara, 1, NEEDS_REWORK, 6, "The conflict markers are still in README.md. Please fix and resubmit.")
    submission(rohan, 0, PENDING, 4, late=True)

    db.add_all([
        ModuleProgress(user_id=aarav.id, module_id=modules[0].id, status=COMPLETED),
        ModuleProgress(user_id=aarav.id, module_id=modules[1].id, status=IN_PROGRESS),
        ModuleProgress(user_id=sara.id, module_id=modules[0].id, status=IN_PROGRESS),
        ModuleProgress(user_id=rohan.id, module_id=modules[0].id, status=IN_PROGRESS),
    ])

    db.add_all([
        DailyLog(user_id=aarav.id, log_date=t - timedelta(days=2), hours=6,
                 description="Worked through the semantic HTML reading list and started the landing page."),
        DailyLog(user_id=aarav.id, log_date=t - timedelta(days=1), hours=7.5,
                 description="Finished the landing page layout and submitted it for review."),
        DailyLog(user_id=sara.id, log_date=t - timedelta(days=1), hours=5,
                 description="Retried the rebase exercise and read about merge strategies.",
                 blockers="Not sure how to keep both changes when the same line conflicts."),
    ])

    db.commit()
    print("Seeded demo data. Log in with any of these (password: %s):" % PASSWORD)
    for user in (mentor, aarav, sara, rohan):
        print(f"  {user.role:<7} {user.email}")


if __name__ == "__main__":
    main()
