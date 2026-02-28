@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git not found. Install Git for Windows.
  pause
  exit /b 1
)

echo Updating to latest from GitHub (discarding local changes)...
git fetch --all
git reset --hard origin/main

IF NOT EXIST node_modules (
  call npm install
)

start "Meme Catalogger (Vite)" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
timeout /t 2 >nul
start "" "http://127.0.0.1:5173"

endlocal