Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Resume Fix MVP - 本地 ATS 评分系统启动脚本 (PowerShell)      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] 检查 npm 包..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "  → 安装依赖..." -ForegroundColor Gray
    npm install
} else {
    Write-Host "  ✓ npm 包已安装" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/2] 检查 Ollama 服务..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -ErrorAction Stop
    Write-Host "  ✓ Ollama 正在运行" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Ollama 未检测到运行" -ForegroundColor Red
    Write-Host "  → 请先启动 Ollama 应用或运行: ollama serve" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  启动 Express 服务器...                                        ║" -ForegroundColor Cyan
Write-Host "║  Frontend: http://localhost:3000                               ║" -ForegroundColor Cyan
Write-Host "║  API: http://localhost:3000/api/*                              ║" -ForegroundColor Cyan
Write-Host "║  Ollama: http://localhost:11434 (必须运行!)                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

node server.js
