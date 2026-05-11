@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=http://localhost:13620"
set "LOG_OUT=server_stdout.log"
set "LOG_ERR=server_stderr.log"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not available in PATH.
    pause
    exit /b 1
)

if not exist "server.js" (
    echo server.js was not found in the current folder.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo Starting Wrapstyle ERP server...
start "Wrapstyle ERP Server" /min cmd /c "cd /d ""%~dp0"" && node server.js > ""%LOG_OUT%"" 2> ""%LOG_ERR%"""

timeout /t 3 /nobreak >nul
start "" "%APP_URL%"

echo Wrapstyle ERP started.
echo Browser: %APP_URL%
echo Logs: %LOG_OUT% / %LOG_ERR%
exit /b 0
