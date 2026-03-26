#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot

Write-Step "Checking required documentation files"

$requiredFiles = @(
    "README.md",
    "AGENTS.md",
    "docs/architecture.md",
    "docs/development-workflow.md",
    "docs/documentation-policy.md",
    "docs/product-plan.md",
    "docs/stakeholder-brief.md",
    ".agents/architect.instruciton.md",
    ".agents/developer.instruciton.md",
    ".agents/product-manager.instruciton.md",
    ".agents/reviewer.instruciton.md",
    ".agents/tester.instruciton.md",
    ".agents/ui-designer.instruciton.md",
    ".agents/ux-designer.instruciton.md"
)

foreach ($relativePath in $requiredFiles) {
    $absolutePath = Join-Path $repoRoot $relativePath
    Assert-PathExists -Path $absolutePath -Message "Required documentation file is missing: $relativePath"
}

Write-Step "Checking README references to primary docs"

$readmePath = Join-Path $repoRoot "README.md"
$readme = Get-Content $readmePath -Raw

$requiredReadmeLinks = @(
    "docs/architecture.md",
    "docs/development-workflow.md",
    "docs/documentation-policy.md",
    "docs/product-plan.md",
    "docs/stakeholder-brief.md",
    "AGENTS.md"
)

foreach ($link in $requiredReadmeLinks) {
    if ($readme -notmatch [regex]::Escape($link)) {
        throw "README.md is missing a required primary-doc reference to '$link'."
    }
}

Write-Success "Documentation checks passed."
