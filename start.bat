@echo off
title Trade - Starting...

echo.
echo  ==========================================
echo   TRADE - Analytical HUD System
echo  ==========================================
echo.
echo  Starting Backend Server...
start "Trade - Backend" cmd /k "cd /d %~dp0 && npm start"

timeout /t 2 /nobreak >nul

echo  Starting Frontend Dev Server...
start "Trade - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Both servers are starting in separate windows.
echo  Close this window or press any key to exit.
echo.
pause >nul
