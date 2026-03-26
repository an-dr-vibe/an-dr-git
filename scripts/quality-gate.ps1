#!/usr/bin/env pwsh
param(
    [string]$PackageManager = "auto",
    [double]$Statements = 90,
    [double]$Branches = 90,
    [double]$Functions = 90,
    [double]$Lines = 90,
    [switch]$SkipIntegration,
    [switch]$SkipE2E,
    [switch]$SkipCoverage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot

Write-Step "Running documentation gate"
& (Join-Path $PSScriptRoot "check-docs.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "Documentation gate failed."
}

$packageJson = Get-PackageJson -RepoRoot $repoRoot
$srcPath = Join-Path $repoRoot "src"

if ($null -eq $packageJson) {
    if (Test-Path $srcPath) {
        throw "src/ exists but package.json is missing. The quality gate cannot continue."
    }

    Write-WarnStep "package.json not found. Skipping code quality commands because the app scaffold does not exist yet."
    Write-Success "Quality gate passed for the current documentation-only repo state."
    exit 0
}

$packageManagerCommand = Get-PackageManagerCommand -RepoRoot $repoRoot -PackageManager $PackageManager

Invoke-PackageScript -RepoRoot $repoRoot -PackageJson $packageJson -PackageManager $packageManagerCommand -ScriptName "lint" -Required $true
Invoke-PackageScript -RepoRoot $repoRoot -PackageJson $packageJson -PackageManager $packageManagerCommand -ScriptName "typecheck" -Required $true
Invoke-PackageScript -RepoRoot $repoRoot -PackageJson $packageJson -PackageManager $packageManagerCommand -ScriptName "test:unit" -Required $true

if (-not $SkipCoverage) {
    & (Join-Path $PSScriptRoot "coverage-gate.ps1") `
        -Statements $Statements `
        -Branches $Branches `
        -Functions $Functions `
        -Lines $Lines

    if ($LASTEXITCODE -ne 0) {
        throw "Coverage gate failed."
    }
}

if (-not $SkipIntegration) {
    Invoke-PackageScript -RepoRoot $repoRoot -PackageJson $packageJson -PackageManager $packageManagerCommand -ScriptName "test:integration" -Required $false
}

if (-not $SkipE2E) {
    Invoke-PackageScript -RepoRoot $repoRoot -PackageJson $packageJson -PackageManager $packageManagerCommand -ScriptName "test:e2e" -Required $false
}

Write-Success "Quality gate passed."
