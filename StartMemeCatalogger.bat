@echo off
cd /d "%~dp0"

start "Meme Catalogger (Vite)" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
start "" "http://127.0.0.1:5173"
