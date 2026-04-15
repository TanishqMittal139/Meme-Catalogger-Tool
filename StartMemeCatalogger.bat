@echo off
setlocal
cd /d "%~dp0"

set "FRONTEND_PORT=5173"
set "BACKEND_PORT=5000"
set "EXPECTED_BRANCH=ai-testing"
set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if "%OLLAMA_MODEL%"=="" set "OLLAMA_MODEL=gemma3,llama3.2-vision"
for /f "tokens=1 delims=," %%M in ("%OLLAMA_MODEL%") do set "PRIMARY_OLLAMA_MODEL=%%~M"

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

python -c "import flask, openai, PIL" >nul 2>nul
if errorlevel 1 (
  echo Installing Python backend dependencies...
  python -m pip install -r "%~dp0server\requirements.txt"
  if errorlevel 1 (
    echo ERROR: Could not install Python backend dependencies.
    pause
    exit /b 1
  )
)

if "%MEME_DB_PATH%"=="" (
  set "MEME_DB_PATH=%~dp0server\memes.db"
)

if exist "%OLLAMA_EXE%" (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if errorlevel 1 (
    echo Starting Ollama...
    start "Ollama" "%OLLAMA_EXE%" serve
    timeout /t 3 >nul
  )

  echo Ensuring Ollama vision model "%PRIMARY_OLLAMA_MODEL%" is installed...
  "%OLLAMA_EXE%" list | findstr /I /C:"%PRIMARY_OLLAMA_MODEL%" >nul
  if errorlevel 1 (
    echo Pulling "%PRIMARY_OLLAMA_MODEL%" for higher-accuracy meme analysis...
    "%OLLAMA_EXE%" pull "%PRIMARY_OLLAMA_MODEL%"
    if errorlevel 1 (
      echo WARNING: Could not pull "%PRIMARY_OLLAMA_MODEL%". AI analysis may fail until the model is installed.
    )
  )
) else (
  echo WARNING: Ollama was not found at "%OLLAMA_EXE%".
)

for %%P in (%BACKEND_PORT% %FRONTEND_PORT%) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    taskkill /PID %%I /F >nul 2>nul
  )
)

start "Meme Catalogger (Flask)" cmd /k "cd /d ""%~dp0server"" && set ""FLASK_PORT=%BACKEND_PORT%"" && set ""MEME_DB_PATH=%MEME_DB_PATH%"" && set ""OLLAMA_MODEL=%OLLAMA_MODEL%"" && python app.py"
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
