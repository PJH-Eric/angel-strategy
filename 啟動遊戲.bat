@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次執行，正在安裝套件...
  call npm ci
)
echo 啟動中，瀏覽器開啟 http://localhost:3110
start "" http://localhost:3110
node server.js
pause
