@echo off
setlocal
cd /d "%~dp0"
set "PORT=8080"

echo =========================================================
echo   CINDY COACH V3 - HYBRID CLEAN MASTER EDITION
echo   Local Server: http://127.0.0.1:%PORT%/index.html
echo =========================================================

set "PY_CMD="
where py >nul 2>nul && set "PY_CMD=py -3"
if not defined PY_CMD (
  if exist "%LOCALAPPDATA%\Programs\Python\Launcher\py.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Launcher\py.exe -3"
  )
)
if not defined PY_CMD (
  where python >nul 2>nul && set "PY_CMD=python"
)

if not defined PY_CMD (
  echo [ERROR] Python not found. Please install Python 3.
  pause
  exit /b 1
)

netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting server on port %PORT%...
  start "CINDY Coach V3 Server" cmd /k %PY_CMD% -m http.server %PORT%
) else (
  echo Server is already listening on port %PORT%.
)

ping 127.0.0.1 -n 3 >nul

start "" "http://127.0.0.1:%PORT%/index.html?v=clean_v3_%random%"

echo Server active at http://127.0.0.1:%PORT%/index.html
endlocal
