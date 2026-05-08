@echo off
chcp 65001 > nul
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  Resume Fix MVP - 本地 ATS 评分系统启动脚本 (Windows)         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 检查依赖...
if not exist node_modules (
    echo [1/3] 安装 npm 包...
    call npm install
) else (
    echo [1/3] npm 包已安装 ✓
)
echo.
echo [2/3] 检查 Ollama 服务...
timeout /t 2 /nobreak > nul

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  启动服务器...                                                 ║
echo ║  Frontend: http://localhost:3000                               ║
echo ║  API: http://localhost:3000/api/*                              ║
echo ║  Ollama: http://localhost:11434 (必须运行!)                    ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

node server.js
pause
