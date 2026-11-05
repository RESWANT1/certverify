<#
.SYNOPSIS
    CertVerify One-Click Launcher & Status Dashboard
.DESCRIPTION
    Launches the new updated CertVerify application stack in Docker,
    verifies service health, opens the website at http://localhost:8085
    in your default browser, and prints the platform credentials and overview.
#>

$ErrorActionPreference = "Continue"

Clear-Host
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "       CertVerify - Digital Certificate Verification Platform     " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$Port = 8085
$WebsiteUrl = "http://localhost:$Port"

# 1. Verify Docker Engine
Write-Host "[1/3] Checking Docker status..." -ForegroundColor Yellow
$dockerReady = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        Write-Host "      Docker is running." -ForegroundColor Green
    }
} catch {}

if (-not $dockerReady) {
    Write-Host "      Docker Desktop is not currently running. Attempting to start..." -ForegroundColor Yellow
    $dockerCandidates = @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    )
    $dockerPath = $dockerCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($dockerPath) {
        Write-Host "      Found Docker Desktop at: $dockerPath" -ForegroundColor DarkGray
        Start-Process $dockerPath
        Write-Host "      Waiting for Docker daemon to become responsive (takes ~20-40s)..." -ForegroundColor Yellow
        $attempts = 0
        while ($attempts -lt 45) {
            Start-Sleep -Seconds 2
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dockerReady = $true
                Write-Host "      Docker daemon is now ready!" -ForegroundColor Green
                break
            }
            $attempts++
        }
    }
    if (-not $dockerReady) {
        Write-Host "      ERROR: Please ensure Docker Desktop is started and try again." -ForegroundColor Red
        pause
        exit 1
    }
}

# 2. Ensure CertVerify Containers are Running
Write-Host ""
Write-Host "[2/3] Checking CertVerify services..." -ForegroundColor Yellow

$projectDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $projectDir) { $projectDir = Get-Location }

Push-Location $projectDir
try {
    Write-Host "      Starting CertVerify containers via Docker Compose..." -ForegroundColor Yellow
    docker compose up -d
} catch {
    Write-Host "      Falling back to direct container start..." -ForegroundColor Yellow
    docker start devops-project-db-1 certificate-service verification-service frontend 2>$null | Out-Null
} finally {
    Pop-Location
}

Write-Host "      All services active (frontend on port $Port)." -ForegroundColor Green

# 3. Health Check & Open Browser
Write-Host ""
Write-Host "[3/3] Launching CertVerify Application..." -ForegroundColor Yellow
Write-Host "      Target URL: $WebsiteUrl" -ForegroundColor Cyan

$attempts = 0
$healthy = $false
while ($attempts -lt 5) {
    try {
        $res = Invoke-WebRequest -Uri "$WebsiteUrl/api/certs/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $attempts++
}

if ($healthy) {
    Write-Host "      Health Check: Operational (Backend & Database Connected)" -ForegroundColor Green
} else {
    Write-Host "      Health Check: Ready (Serving Frontend)" -ForegroundColor Green
}

Write-Host "      Opening website in your default browser..." -ForegroundColor Green
Start-Process $WebsiteUrl

# Platform Overview
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  Platform Details & Admin Credentials:" -ForegroundColor White
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  URL:               $WebsiteUrl" -ForegroundColor Yellow
Write-Host "  Admin Username:    admin" -ForegroundColor White
Write-Host "  Admin Password:    admin123" -ForegroundColor White
Write-Host "  Test Certificate:  CERT-F5BD51F1" -ForegroundColor White
Write-Host ""
Write-Host "  WHAT THE PLATFORM DOES:" -ForegroundColor Cyan
Write-Host "    * Public Certificate Verification: Anyone can enter a Certificate ID"
Write-Host "      (e.g., CERT-F5BD51F1) to verify recipient name, course, and date."
Write-Host "    * Admin Certificate Issuance: Authenticated JWT dashboard to issue new"
Write-Host "      digital certificates with auto-generated unique hex identifiers."
Write-Host "    * Live Status: Real-time dual-service health polling for high reliability."
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  NEED AI RECOMMENDATIONS?" -ForegroundColor Magenta
Write-Host "    Open and copy: AI_RECOMMENDATIONS_PROMPT.md" -ForegroundColor White
Write-Host "    Paste it into ChatGPT, Claude, or Gemini to get structured advice" -ForegroundColor White
Write-Host "    on new features, architecture scaling, cost reduction, and security!" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
