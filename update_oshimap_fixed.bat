@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo OSHIMAP UPDATE
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

echo.
echo ==========================================
echo UPDATE COMPLETED
echo GitHub push: SUCCESS
echo ==========================================
echo.
echo If iPhone shows old data, add a cache-busting
echo query such as ?v=20261003-2 to the URL.
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
