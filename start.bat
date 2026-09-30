@echo off
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS first.
 pause
 exit /b 1
)
call npm install
if errorlevel 1 (
 pause
 exit /b 1
)
call npm run dev -- --open
pause
