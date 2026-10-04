"""Intern Training Management System - API and static frontend.

Run from the backend folder:  uvicorn app.main:app --reload
Then open http://127.0.0.1:8000
"""
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .database import BACKEND_DIR, Base, engine
from .routers import assignments, auth, logs, modules, progress, submissions
from .validation import FieldErrors

Base.metadata.create_all(engine)

app = FastAPI(title="Intern Training Management System", version="1.0")

# CORS is limited to the frontend origin(s). Only needed when the frontend is
# served separately (VS Code Live Server on 5500, Live Preview on 3000);
# same-origin needs no CORS.
origins = os.environ.get(
    "FRONTEND_ORIGINS",
    "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:3000,http://localhost:3000",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(FieldErrors)
def field_errors_handler(request: Request, exc: FieldErrors):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": next(iter(exc.errors.values())), "errors": exc.errors},
    )


@app.exception_handler(RequestValidationError)
def request_validation_handler(request: Request, exc: RequestValidationError):
    """Wrong types (text in a number field, a malformed date) -> 400 per the FRD."""
    errors = {}
    for error in exc.errors():
        field = str(error["loc"][-1])
        kind = error["type"]
        if "date" in kind:
            message = "Enter a valid date"
        elif "int" in kind or "float" in kind:
            message = "Enter a valid number"
        else:
            message = "Enter a valid value"
        errors.setdefault(field, message)
    detail = next(iter(errors.values()), "Invalid request")
    return JSONResponse(status_code=400, content={"detail": detail, "errors": errors})


for module in (auth, modules, assignments, submissions, logs, progress):
    app.include_router(module.router)

# Mounted last so API routes win; pages are served as /login.html etc.
app.mount("/", StaticFiles(directory=BACKEND_DIR.parent / "frontend", html=True), name="frontend")
