@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo OSHIMAP ONE-CLICK UPDATE
echo ==========================================
echo.

rem ---- Safety checks ----
if not exist ".git" (
  echo ERROR: This folder is not the Git repository.
  echo Put this BAT in:
  echo C:\Users\y0910\Desktop\shooting-now
  goto error
)

if not exist "update_models.py" (
  echo ERROR: update_models.py was not found.
  goto error
)

echo [1/6] Checking GitHub connection...
git fetch origin
if errorlevel 1 goto error

echo.
echo [2/6] Updating local branch from GitHub...
git pull --rebase --autostash origin main
if errorlevel 1 goto error

echo.
echo [3/6] Rebuilding shooting history and image data...
python update_models.py
if errorlevel 1 goto error

echo.
echo [4/6] Checking image file sizes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$bad=Get-ChildItem -LiteralPath 'shooting_images' -Recurse -File -ErrorAction SilentlyContinue | Where-Object {$_.Length -ge 95MB}; if($bad){Write-Host 'ERROR: The following image files are 95 MB or larger:' -ForegroundColor Red; $bad | ForEach-Object {Write-Host $_.FullName}; exit 1}else{exit 0}"
if errorlevel 1 goto error

echo.
echo [5/6] Staging only Oshimap history/image data...
git add -A -- shooting_history.json shooting_images
if errorlevel 1 goto error

git diff --cached --quiet
if not errorlevel 1 goto nochanges

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%I"

git commit -m "Update shooting history and photos %STAMP%"
if errorlevel 1 goto error

echo.
echo [6/6] Pushing to GitHub...
git push origin main
if errorlevel 1 goto error

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "CACHE=%%I"
set "PUBLIC_URL=https://yuuuuuu111110281119.github.io/shooting-now/?v=%CACHE%"

echo.
echo ==========================================
echo UPDATE COMPLETED
echo ==========================================
echo Shooting history : updated
echo Image data       : updated
echo GitHub           : pushed
echo.
echo Latest URL:
echo %PUBLIC_URL%
echo.
echo Opening the fresh GitHub Pages URL...
start "" "%PUBLIC_URL%"
echo.
echo On iPhone, open the same URL shown above.
echo GitHub Pages may need a short time to publish.
echo.
pause
exit /b 0

:nochanges
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "CACHE=%%I"
set "PUBLIC_URL=https://yuuuuuu111110281119.github.io/shooting-now/?v=%CACHE%"
echo.
echo ==========================================
echo NO DATA CHANGES FOUND
echo ==========================================
echo Nothing needed to be pushed.
echo.
echo Current cache-busting URL:
echo %PUBLIC_URL%
echo.
start "" "%PUBLIC_URL%"
pause
exit /b 0

:error
echo.
echo ==========================================
echo UPDATE FAILED
echo ==========================================
echo No automatic push was completed.
echo Read the error message above.
echo.
pause
exit /b 1
