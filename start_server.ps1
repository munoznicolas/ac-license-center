# start_server.ps1
# 1-Click root launcher for AC License Center Web UI
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$repoRoot = $PSScriptRoot
# Refresh Environment PATH from Registry
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AC LICENSE CENTER - 1-CLICK ROOT LAUNCHER" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$pyServer = Join-Path $repoRoot "tools\web_ui\server.py"
$hasPython = (Get-Command python -ErrorAction SilentlyContinue)

if ($hasPython -and (Test-Path $pyServer)) {
    Write-Host "[INFO] Launching full Python server (tools/web_ui/server.py)..." -ForegroundColor Green
    $argsList = @($pyServer, "--port", "$Port")
    if ($NoBrowser) { $argsList += "--no-browser" }
    & python $argsList
} else {
    Write-Host "[INFO] Python not found; launching zero-dependency PowerShell server..." -ForegroundColor Yellow
    $psServer = Join-Path $repoRoot "tools\web_ui\local_server.ps1"
    $params = @{ Port = $Port }
    if ($NoBrowser) { $params["NoBrowser"] = $true }
    & $psServer @params
}
