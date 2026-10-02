@echo off
rem Starts the app in the virtual environment and opens it in the browser.
cd /d "%~dp0backend"
if not exist "%USERPROFILE%\.venvs\itms\Scripts\python.exe" (
  echo Virtual environment not found. See README.md, "Run it".
  pause
  exit /b 1
)
"%USERPROFILE%\.venvs\itms\Scripts\python.exe" seed.py
start "" http://127.0.0.1:8000
"%USERPROFILE%\.venvs\itms\Scripts\python.exe" -m uvicorn app.main:app --port 8000
pause
