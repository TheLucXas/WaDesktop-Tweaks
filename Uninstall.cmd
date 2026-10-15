@echo off
rem Double-click to remove WaDesktop-Tweaks (asks for administrator permission).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\uninstall.ps1"
