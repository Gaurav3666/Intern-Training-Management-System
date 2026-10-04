"""Server-side validation helpers.

Every rule in the FRD is checked here so the API never relies on the frontend.
Failures are collected per field and returned as
{"detail": "<first message>", "errors": {"<field>": "<message>"}}.
"""


class FieldErrors(Exception):
    def __init__(self, errors: dict[str, str], status_code: int = 400):
        self.errors = errors
        self.status_code = status_code


class Checker:
    def __init__(self):
        self.errors: dict[str, str] = {}

    def add(self, field: str, message: str) -> None:
        self.errors.setdefault(field, message)

    def text(self, field: str, value: str | None, label: str, *, max_len: int,
             min_len: int = 1, required: bool = True) -> str | None:
        """Trim and length-check a text value. Returns None when empty."""
        value = (value or "").strip()
        if not value:
            if required:
                self.add(field, f"{label} is required")
            return None
        if len(value) < min_len:
            self.add(field, f"{label} must be at least {min_len} characters")
        elif len(value) > max_len:
            self.add(field, f"{label} must be at most {max_len} characters")
        return value

    def done(self) -> None:
        if self.errors:
            raise FieldErrors(self.errors)
