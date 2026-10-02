# InternPath — Intern Training Management System

MVP built from **FRD v1.0**: FastAPI + SQLite backend, HTML / CSS / vanilla JS frontend.
Interns follow modules, submit assignments and write daily logs; mentors create the
content, review work and track progress.

## Run it

Everything runs inside a virtual environment. It lives outside the project
(`%USERPROFILE%\.venvs\itms`) because the Desktop is synced by OneDrive and a
venv holds thousands of files.

```powershell
# one-time setup (already done on this machine)
python -m venv $env:USERPROFILE\.venvs\itms
& $env:USERPROFILE\.venvs\itms\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# every time
& $env:USERPROFILE\.venvs\itms\Scripts\Activate.ps1
cd backend
python seed.py                       # demo data, only fills an empty database
uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000>. FastAPI serves the frontend too, so there is one
address and no CORS setup. API docs: <http://127.0.0.1:8000/docs>.

### Demo accounts (password `Demo1234`)

| Role   | Email             | What to look at                              |
|--------|-------------------|----------------------------------------------|
| Mentor | mentor@demo.com   | Dashboard chart, pending reviews             |
| Intern | aarav@demo.com    | Furthest along, one submission pending       |
| Intern | sara@demo.com     | A "Needs Rework" submission and overdue work |
| Intern | rohan@demo.com    | A late submission, no logs                   |

To start again from clean data, stop the server, delete `backend/itms.db` and run `python seed.py`.

## Structure

```
backend/
  app/
    main.py          app, CORS, error format, static frontend
    models.py        tables (FRD section 5)
    schemas.py       request bodies
    validation.py    field-level validation helper
    security.py      bcrypt, JWT, role guards, login throttle
    services.py      access scoping, overdue rule, progress formulas
    routers/         auth, modules, assignments, submissions, logs, progress
  seed.py            demo data
frontend/
  *.html             one file per screen (S1 to S11)
  css/styles.css     design tokens and components
  js/app.js          session, API client, header, toasts, forms
  js/<screen>.js     behaviour for each screen
```

| Screen | File | Screen | File |
|---|---|---|---|
| S1 Login | `login.html` | S7 Daily Logs | `logs.html` |
| S2 Signup | `signup.html` | S8 Mentor Dashboard | `mentor-dashboard.html` |
| S3 Intern Dashboard | `intern-dashboard.html` | S9 Review Submissions | `reviews.html` |
| S4 Modules | `modules.html` | S10 Intern Detail | `intern.html` |
| S5 Assignments | `assignments.html` | S11 Profile | `profile.html` |
| S6 Assignment Detail | `assignment.html` | | |

## UX decisions

- **Visual hierarchy:** one page title, one primary button per screen, everything else secondary.
- **Progressive disclosure:** signup shows intern fields only for interns; the submission form appears only when a submission is possible.
- **Error prevention:** the module status dropdown offers only the moves the rules allow; date pickers are limited to valid ranges; submit buttons lock while a request runs.
- **Inline validation:** each error sits under its field, says how to fix it, and focus moves to the first one.
- **System feedback:** loading bar on every request, success and error toasts, live result counts on filters.
- **Empty states:** every list says what is missing and what to do next.
- **Consistency:** the same status badges, cards and tables on every screen.
- **Typography:** Poppins for headings and figures, Raleway for text.

## Accessibility (WCAG 2.2 AA)

- Semantic landmarks, one `h1` per page, ordered headings, skip link.
- Every control has a visible label; errors are linked with `aria-describedby` and `aria-invalid`.
- Full keyboard use: native dialogs trap and return focus, tabs follow the ARIA tabs pattern, table rows have a real link.
- Status is never colour alone: every badge carries text.
- Text contrast at least 4.5:1 in light and dark themes; visible 3px focus ring.
- 44px targets, works from 360px width, wide tables scroll inside a focusable region.
- Toasts and counts use live regions; error toasts stay until dismissed.
- `prefers-reduced-motion` and `forced-colors` are respected.

Checked with axe-core on every screen at 1280px (light) and 360px (dark): 0 violations.
Automated checks cannot cover everything; a manual screen reader pass has not been done.

## Where the build goes beyond or reads the FRD

- **PRD:** only the FRD was available, so the build follows the FRD.
- `GET /assignments/{id}` and an `assignment_id` filter on `GET /submissions` were added for the Assignment Detail screen.
- `GET /progress/summary` returns `{ pending_reviews, interns: [...] }` so the dashboard gets its count in one call.
- Validation errors return 400 with `{"detail": "...", "errors": {"field": "..."}}` so the frontend can place each message.
- The login block (5 failures, 5 minutes) returns 429 and is kept in memory, so it resets when the server restarts.
- Any mentor can add an assignment to any module; editing is limited to the creator, like modules.
- For a mentor, the assignment status filter matches assignments where at least one of their interns is in that state.
- Fonts and Chart.js load from a CDN, so the pages need an internet connection.
- `SECRET_KEY` can be set as an environment variable; otherwise a random key is generated once in `backend/.secret_key`.
