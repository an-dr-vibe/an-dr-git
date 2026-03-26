Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    $scriptRoot = Split-Path -Parent $PSScriptRoot
    return (Resolve-Path $scriptRoot).Path
}

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "OK: $Message" -ForegroundColor Green
}

function Write-WarnStep {
    param([string]$Message)
    Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Message
    )

    if (-not (Test-Path $Path)) {
        throw $Message
    }
}

function Get-PackageManagerCommand {
    param(
        [string]$RepoRoot,
        [string]$PackageManager = "auto"
    )

    switch ($PackageManager) {
        "npm" { return "npm" }
        "pnpm" { return "pnpm" }
        "yarn" { return "yarn" }
        "auto" {
            if (Test-Path (Join-Path $RepoRoot "pnpm-lock.yaml")) { return "pnpm" }
            if (Test-Path (Join-Path $RepoRoot "yarn.lock")) { return "yarn" }
            return "npm"
        }
        default {
            throw "Unsupported package manager '$PackageManager'. Use auto, npm, pnpm, or yarn."
        }
    }
}

function Get-PackageJson {
    param([string]$RepoRoot)

    $packageJsonPath = Join-Path $RepoRoot "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        return $null
    }

    return Get-Content $packageJsonPath -Raw | ConvertFrom-Json
}

function Test-PackageScript {
    param(
        [pscustomobject]$PackageJson,
        [string]$ScriptName
    )

    if ($null -eq $PackageJson) {
        return $false
    }

    $scripts = $PackageJson.scripts
    if ($null -eq $scripts) {
        return $false
    }

    $properties = $scripts.PSObject.Properties.Name
    return $properties -contains $ScriptName
}

function Invoke-PackageScript {
    param(
        [string]$RepoRoot,
        [pscustomobject]$PackageJson,
        [string]$PackageManager,
        [string]$ScriptName,
        [bool]$Required = $true
    )

    if (-not (Test-PackageScript -PackageJson $PackageJson -ScriptName $ScriptName)) {
        if ($Required) {
            throw "Required package script '$ScriptName' is missing from package.json."
        }

        Write-WarnStep "Skipping optional package script '$ScriptName' because it is not defined."
        return
    }

    Write-Step "Running package script '$ScriptName'"
    Push-Location $RepoRoot
    try {
        & $PackageManager run $ScriptName
        if ($LASTEXITCODE -ne 0) {
            throw "Package script '$ScriptName' failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
