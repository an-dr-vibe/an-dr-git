# Phase 3 Plan

## Purpose

This document turns Phase 3 from a milestone into an executable backlog.

Phase 3 is the sync phase. Its job is to add push and pull workflows without weakening the main-process Git boundary, the per-repository write queue, or the product rule that Git truth must stay visible.

This phase is complete only when:

- the app can resolve sync state for the active branch through typed IPC
- pull uses `git pull --ff-only`
- push and upstream setup stay explicit instead of being guessed
- raw Git stderr remains visible for auth, rejection, and fast-forward failures
- the delivered artifact lets a stakeholder open a repo and exercise real sync flows immediately

## Status

Phase 3 is planned next as of March 26, 2026.

Phase 2 is complete and now provides the tree selection, branch emphasis, and diff visibility that Phase 3 will extend with actionable sync state.

## Phase Goal

Deliver the first safe sync experience: upstream resolution, pull, push, and explicit progress and failure handling inside the existing shell.

## Non-Goals

Do not expand into these during Phase 3:

- commit authoring or staging
- merge, rebase, stash, cherry-pick, or history browsing
- custom credential prompts or credential storage
- commit graph or branch-topology visualization
- background auto-sync behavior

## Deliverables

Phase 3 must deliver:

- shared sync domain types under `src/shared`
- typed IPC request/response for sync state, pull, and push
- main-process sync service using native Git CLI commands
- current-branch upstream resolution and missing-upstream detection
- pull flow using `git pull --ff-only`
- push flow using `git push` and explicit upstream setup when needed
- renderer sync affordances integrated into the branch area
- explicit progress, success, warning, and failure states with raw stderr visibility

## Backlog Order

### Slice 3.1: Sync State Contracts

Goal:

Define the shared sync-state model and typed IPC surface.

Deliverables:

- `RepositorySyncState`
- `PullRequest`
- `PushRequest`
- sync IPC contracts and runtime validation

Acceptance criteria:

- renderer can request sync state only through validated IPC
- detached HEAD, missing upstream, gone upstream, and ahead/behind state remain explicit
- later sync actions can reuse the same contracts without renderer-side Git inference

Verification:

- unit tests for sync contract validation
- integration test for sync-state happy path and invalid-payload handling

### Slice 3.2: Pull Flow

Goal:

Execute a safe pull flow that does not hide Git semantics.

Deliverables:

- main-process pull command path using `git pull --ff-only`
- operation-state reporting through typed IPC
- failure mapping that preserves raw Git stderr

Acceptance criteria:

- fast-forward success is visible only after Git exits successfully
- fast-forward refusal is surfaced as a first-class outcome
- auth and network failures remain explicit instead of being normalized

Verification:

- unit tests for pull command mapping
- integration tests for fast-forward success and refusal

### Slice 3.3: Push Flow

Goal:

Add a trustworthy push workflow with explicit upstream handling.

Deliverables:

- push command path using `git push`
- first-push upstream setup path using `git push --set-upstream <remote> <branch>`
- rejection and hook-failure visibility

Acceptance criteria:

- push uses the resolved upstream when it exists
- no-upstream state is explicit before the action runs
- Git rejection reasons remain verbatim in the UI

Verification:

- unit tests for push command mapping
- integration tests for upstream setup and rejection cases

### Slice 3.4: Sync UI Integration

Goal:

Integrate actionable sync state into the current shell without turning it into a wizard.

Deliverables:

- branch-area sync affordances
- progress, success, warning, and failure messaging
- raw-output disclosure for failed sync commands

Acceptance criteria:

- branch state and sync actions stay visually connected
- risky states remain explicit before the user acts
- the shell still feels like one coherent tool instead of separate sync dialogs

Verification:

- state-matrix walkthrough for sync states
- manual keyboard verification for branch-to-sync actions
- screenshot or manual visual verification on a real repository

### Slice 3.5: Artifact And Review Gate

Goal:

Ship Phase 3 as a stakeholder-usable build, not just code.

Deliverables:

- updated docs for sync workflows and failure behavior
- fresh packaged artifact under `artifacts/forge/`
- review of sync risk, coverage, and known gaps

Acceptance criteria:

- `pwsh ./scripts/quality-gate.ps1` passes with Phase 3 coverage included
- `npm run package:verify` succeeds on supported hosts
- the delivered artifact opens a repository and runs real pull and push flows or explicit failure paths

Verification:

- quality gate output
- packaged-app verification output
- concise reviewer findings log or explicit note that no blocking findings were found
