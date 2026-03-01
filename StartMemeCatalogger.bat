@echo off
setlocal
cd /d "%~dp0"

set "FRONTEND_PORT=5173"
set "BACKEND_PORT=5000"
set "EXPECTED_BRANCH=database-testing"

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python not found. Install Python and try again.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git not found. Install Git and try again.
  pause
  exit /b 1
)

set "CURRENT_BRANCH="
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%B"
if not defined CURRENT_BRANCH (
  echo ERROR: Could not detect git branch.
  pause
  exit /b 1
)

if /I not "%CURRENT_BRANCH%"=="%EXPECTED_BRANCH%" (
  echo ERROR: Current branch is "%CURRENT_BRANCH%". Switch to "%EXPECTED_BRANCH%" first.
  pause
  exit /b 1
)

echo Updating latest code from origin/%EXPECTED_BRANCH%...
git fetch origin %EXPECTED_BRANCH%
if errorlevel 1 (
  echo WARNING: git fetch failed. Continuing with local code.
) else (
  git pull --ff-only origin %EXPECTED_BRANCH%
  if errorlevel 1 (
    echo WARNING: git pull failed. Continuing with local code.
  )
)

IF NOT EXIST node_modules (
  call npm install
)

if "%MEME_DB_PATH%"=="" (
  set "MEME_DB_PATH=%~dp0server\memes.db"
)

for %%P in (%BACKEND_PORT% %FRONTEND_PORT%) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    taskkill /PID %%I /F >nul 2>nul
  )
)

start "Meme Catalogger (Flask)" cmd /k "cd /d ""%~dp0server"" && set ""FLASK_PORT=%BACKEND_PORT%"" && set ""MEME_DB_PATH=%MEME_DB_PATH%"" && python app.py"
start "Meme Catalogger (Vite)" cmd /k "cd /d ""%~dp0"" && npx vite --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"

set "BACKEND_READY=0"
for /l %%A in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%BACKEND_PORT%/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "BACKEND_READY=1"
    goto :open_browser
  )
  timeout /t 1 >nul
)

:open_browser
if "%BACKEND_READY%"=="0" (
  echo WARNING: Backend did not report healthy within 20 seconds.
)
start "" "http://127.0.0.1:%FRONTEND_PORT%"

endlocal
