@echo off
setlocal
cd /d "%~dp0"

set "FRONTEND_PORT=5173"
set "BACKEND_PORT=5000"

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python not found. Install Python and try again.
  pause
  exit /b 1
)

IF NOT EXIST node_modules (
  call npm install
)

if "%MEME_DB_PATH%"=="" (
  set "MEME_DB_PATH=%~dp0server\memes.db"
)

start "Meme Catalogger (Flask)" cmd /k "cd /d ""%~dp0server"" && set ""FLASK_PORT=%BACKEND_PORT%"" && set ""MEME_DB_PATH=%MEME_DB_PATH%"" && python -c ""import flask"" 1>nul 2>nul || pip install -r requirements.txt && python app.py"
start "Meme Catalogger (Vite)" cmd /k "npm run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"

timeout /t 3 >nul
start "" "http://127.0.0.1:%FRONTEND_PORT%"

endlocal
