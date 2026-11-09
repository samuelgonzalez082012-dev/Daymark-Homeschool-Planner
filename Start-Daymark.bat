@echo off
setlocal
cd /d "%~dp0"
title Daymark - Local Ollama AI
where py >nul 2>nul
if not errorlevel 1 (
  py -3 serve.py
  goto :finished
)
where python >nul 2>nul
if not errorlevel 1 (
  python serve.py
  goto :finished
)
echo.
echo Python 3 was not found.
echo Install Python 3, then double-click this file again.
echo No extra Python packages are required.
pause
:finished
endlocal
