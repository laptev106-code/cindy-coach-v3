@echo off
setlocal
cd /d "%~dp0"
set "PORT=8080"

echo Starting CINDY Lite on http://127.0.0.1:%PORT%/
where py >nul 2>nul
if %errorlevel%==0 (
  start "CINDY Lite Server" cmd /k py -3 -m http.server %PORT%
) else (
  where python >nul 2>nul
  if %errorlevel% neq 0 (
    echo Python was not found. Install Python 3 and run this file again.
    pause
    exit /b 1
  )
  start "CINDY Lite Server" cmd /k python -m http.server %PORT%
)

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/index.html"
endlocal
