@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title AC License Center - Local Server

echo ==========================================================
echo   AC LICENSE CENTER - 1-CLICK LOCAL SERVER LAUNCHER
echo ==========================================================

:: Refresh PATH from Registry in case of newly installed Python/Node
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%b"
if defined SYS_PATH set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

:: Check if Python is available
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Starting server via Python (tools\web_ui\server.py)...
    echo [INFO] Web UI will open at http://localhost:8080
    echo [INFO] Press Ctrl+C to stop the server.
    echo.
    python tools\web_ui\server.py --port 8080 %*
    goto :end
)

:: Fallback: PowerShell zero-dependency server
echo [WARN] Python not found in PATH; falling back to native PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\web_ui\local_server.ps1" -Port 8080 %*

:end
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped or failed to launch.
    pause
)
