#!/usr/bin/env pwsh
param(
    [string]$CoverageFile = "coverage/coverage-summary.json",
    [double]$Statements = 90,
    [double]$Branches = 90,
    [double]$Functions = 90,
    [double]$Lines = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
$coveragePath = Join-Path $repoRoot $CoverageFile

Write-Step "Checking coverage thresholds"
Assert-PathExists -Path $coveragePath -Message "Coverage summary file not found: $CoverageFile"

$coverage = Get-Content $coveragePath -Raw | ConvertFrom-Json
$total = $coverage.total

if ($null -eq $total) {
    throw "Coverage summary file does not contain a 'total' section."
}

$metrics = @(
    @{ Name = "statements"; Actual = [double]$total.statements.pct; Required = $Statements },
    @{ Name = "branches"; Actual = [double]$total.branches.pct; Required = $Branches },
    @{ Name = "functions"; Actual = [double]$total.functions.pct; Required = $Functions },
    @{ Name = "lines"; Actual = [double]$total.lines.pct; Required = $Lines }
)

foreach ($metric in $metrics) {
    $name = $metric.Name
    $actual = $metric.Actual
    $required = $metric.Required

    Write-Host ("{0}: {1}% (required: {2}%)" -f $name, $actual, $required)

    if ($actual -lt $required) {
        throw "Coverage gate failed for '$name': $actual% is below required $required%."
    }
}

Write-Success "Coverage gate passed."
