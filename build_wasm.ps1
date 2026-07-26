param (
    [Parameter(Mandatory=$true)][string]$ModelFolder,
    [Parameter(Mandatory=$true)][string]$OutputName
)

Write-Host "🚀 Activating Emscripten..." -ForegroundColor Cyan
# Adjust this path if your emsdk folder is located somewhere else
cd ..\emsdk
.\emsdk_env.ps1
cd ..\sovereign-rag

Write-Host "🧠 Compiling WebAssembly Graph for $ModelFolder..." -ForegroundColor Cyan
# Using the Python bypass method to ensure it never fails on Windows
python -c "import sys; from mlc_llm.__main__ import main; sys.argv=['mlc_llm', 'compile', './public/models/$ModelFolder', '--device', 'webgpu', '-o', './public/wasm/$OutputName.wasm']; main()"

Write-Host "✅ Compilation Complete! Saved to public/wasm/$OutputName.wasm" -ForegroundColor Green