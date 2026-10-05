@echo off
cd /d "%~dp0"
python update_models.py
if errorlevel 1 (
  echo UPDATE FAILED
  pause
  exit /b 1
)
echo UPDATE COMPLETED
pause
