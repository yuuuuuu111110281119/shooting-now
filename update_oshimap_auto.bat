@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo OSHIMAP AUTO UPDATE
echo ==========================================
echo.

echo [1/4] Updating shooting history and photos...
python update_models.py
if errorlevel 1 goto error

echo.
echo [2/4] Staging updated data...
git add shooting_history.json shooting_images
if errorlevel 1 goto error

echo.
echo [3/4] Checking for changes...
git diff --cached --quiet
if not errorlevel 1 goto nochanges

git commit -m "Update shooting history and photos"
if errorlevel 1 goto error

echo.
echo [4/4] Pushing to GitHub...
git push origin main
if errorlevel 1 goto error

rem Create a unique cache-busting value from local date/time.
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "CACHE=%%I"

set "PUBLIC_URL=https://yuuuuuu111110281119.github.io/shooting-now/?v=%CACHE%"

echo.
echo ==========================================
echo UPDATE COMPLETED
echo GitHub push: SUCCESS
echo ==========================================
echo.
echo Latest iPhone / Safari URL:
echo %PUBLIC_URL%
echo.
echo Opening the latest URL in your default browser...
start "" "%PUBLIC_URL%"
echo.
echo Keep this URL if you want to open the same fresh version on iPhone.
echo.
pause
exit /b 0

:nochanges
echo.
echo ==========================================
echo NO CHANGES FOUND
echo Nothing was pushed.
echo ==========================================
echo.
pause
exit /b 0

:error
echo.
echo ==========================================
echo UPDATE FAILED
echo Check the error message above.
echo ==========================================
echo.
pause
exit /b 1
