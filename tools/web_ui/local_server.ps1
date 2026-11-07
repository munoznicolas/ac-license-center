# local_server.ps1
# Zero-dependency, instant local HTTP server in PowerShell using .NET HttpListener
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$staticDir = Join-Path $PSScriptRoot "static"
$gtJsonPath = Join-Path $repoRoot "docs\Gran_Turismo_License_Tests.json"
$curriculumPath = Join-Path $repoRoot "data\curriculum.json"

# Auto-detect available port starting from $Port
$listener = $null
$selectedPort = $Port
$maxAttempts = 10

for ($i = 0; $i -lt $maxAttempts; $i++) {
    $candidatePort = $Port + $i
    $prefix = "http://localhost:$candidatePort/"
    try {
        $tempListener = New-Object System.Net.HttpListener
        $tempListener.Prefixes.Add($prefix)
        $tempListener.Start()
        $listener = $tempListener
        $selectedPort = $candidatePort
        break
    } catch {
        if ($tempListener) { $tempListener.Close() }
    }
}

if (-not $listener) {
    Write-Error "Could not bind to any port between $Port and $($Port + $maxAttempts - 1)."
    exit 1
}

$url = "http://localhost:$selectedPort/"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AC LICENSE CENTER - LOCAL DEVELOPMENT SERVER" -ForegroundColor Green
Write-Host "  URL: $url" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C in this console to stop the server." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $NoBrowser) {
    try {
        Start-Process $url
    } catch {
        Write-Warning "Could not automatically open browser: $_"
    }
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $path = $request.Url.LocalPath

        # API Handlers
        if ($path -like "/api/reference_tests*" -or $path -like "/api/reference-tests*") {
            $response.ContentType = "application/json; charset=utf-8"
            if (Test-Path $gtJsonPath) {
                $rawGt = [System.IO.File]::ReadAllText($gtJsonPath, [System.Text.Encoding]::UTF8)
                $jsonResponse = "{`"success`":true,`"tests`":$rawGt}"
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $err = '{"success":false,"error":"Reference tests JSON not found"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 404
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        if ($path -like "/api/curriculum*") {
            $response.ContentType = "application/json; charset=utf-8"
            if (Test-Path $curriculumPath) {
                $rawCurr = [System.IO.File]::ReadAllText($curriculumPath, [System.Text.Encoding]::UTF8)
                $jsonResponse = "{`"success`":true,`"curriculum`":$rawCurr}"
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $err = '{"success":true,"curriculum":[]}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        if ($path -like "/api/*") {
            $response.ContentType = "application/json; charset=utf-8"
            $emptyRes = '{"success":true,"tracks":[],"cars":[]}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($emptyRes)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        $relPath = $path.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        $localFile = Join-Path $staticDir $relPath
        if (Test-Path $localFile -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $mime
            $fileBytes = [System.IO.File]::ReadAllBytes($localFile)
            $response.ContentLength64 = $fileBytes.Length
            $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $response.ContentLength64 = $notFound.Length
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }
        $response.Close()
    }
} finally {
    if ($listener) {
        $listener.Stop()
        $listener.Close()
    }
}
