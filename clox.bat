@echo off
rem clox screensaver launcher — opens fullscreen (kiosk) with no browser chrome.
rem Tries Chrome first, falls back to Edge.
set "PAGE=file:///%~dp0index.html"
start "" chrome --kiosk --new-window "%PAGE%" 2>nul && exit /b
start "" msedge --kiosk --new-window "%PAGE%" 2>nul
