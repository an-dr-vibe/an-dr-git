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

## Architecture Decisions

These decisions must be in place before implementation starts:

### Sync State Is Derived Client-Side

The snapshot already carries `head.upstreamName`, `head.aheadCount`, `head.behindCount`, and `branches.local[].trackingStatus`. A pure `deriveRepositorySyncState(snapshot)` helper in `src/shared/domain/` computes the sync state from that data. No new IPC channel is needed for reads.

Pull and push are the only new IPC calls.

### Write Queue Required For Pull And Push

Pull and push are write operations. Both must go through `session.runOperation("write", ...)` in the sync service, consistent with the per-repository serialization model.

### Remote Name For Upstream Setup

When pushing to a branch with no upstream:

- if `head.upstreamName` is present but tracking status is "gone", report the error explicitly and do not push.
- if `head.upstreamName` is absent, the renderer derives the remote name from the snapshot's remote branches or falls back to `"origin"`. The renderer passes `{ remote, branch }` explicitly in the `PushRequest`; the service never guesses.

### IPC Surface

New channels added to `APP_SHELL_CHANNELS` and `AppShellApi`:

- `pullRepository: "app-shell:pull-repository"` — takes `{ sessionId }`, returns `RepositoryPullResult`
- `pushRepository: "app-shell:push-repository"` — takes `{ sessionId, setUpstream? }`, returns `RepositoryPushResult`

### Coverage Config

`vitest.unit.config.ts` must include `src/shared/contracts/repository-sync.ts` and `src/main/repository/repository-sync-service.ts` in its coverage include list.

## Deliverables

Phase 3 must deliver:

- shared sync contracts under `src/shared/contracts/repository-sync.ts`
- `deriveRepositorySyncState` helper in `src/shared/domain/`
- typed IPC request/response for pull and push only (sync state is derived client-side)
- main-process sync service using native Git CLI commands, with write-queue serialization
- current-branch upstream resolution with explicit missing and gone states
- pull flow using `git pull --ff-only`
- push flow using `git push` and explicit `--set-upstream <remote> <branch>` when remote is passed
- renderer sync affordances integrated into the branch area
- explicit progress, success, warning, and failure states with raw stderr visibility
- `vitest.unit.config.ts` updated to include sync modules in coverage measurement

## Backlog Order

### Slice 3.1: Sync State Contracts

Goal:

Define the shared sync-state model, derivation helper, and typed IPC surface for pull and push.

Deliverables:

- `RepositorySyncState` discriminated union (no-repository, detached, unborn, no-upstream, gone-upstream, in-sync, ahead, behind, diverged)
- `deriveRepositorySyncState(snapshot)` pure function in `src/shared/domain/`
- `RepositoryPullRequest` / `RepositoryPullResult`
- `RepositoryPushRequest` / `RepositoryPushResult`
- sync IPC channels added to `APP_SHELL_CHANNELS` and `AppShellApi`
- runtime validation for all request and result types

Acceptance criteria:

- sync state is a pure derivation from snapshot data — no new read IPC channel
- detached HEAD, unborn, no-upstream, gone-upstream, in-sync, ahead, behind, and diverged are explicit discriminants
- pull and push request types carry only what the service needs to execute safely
- `PushRequest` carries an optional `setUpstream: { remote, branch }` field so the service never guesses the remote

Verification:

- unit tests for sync contract validation
- unit tests for `deriveRepositorySyncState` covering all discriminants

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

- branch-area sync affordances (pull button, push button, upstream label)
- progress, success, warning, and failure messaging
- raw-output disclosure for failed sync commands

Sync UI State Matrix:

| State | Pull enabled | Push enabled | Notes |
|---|---|---|---|
| no-repository | no | no | No session |
| loading / no-snapshot | no | no | Snapshot not yet ready |
| detached HEAD | no | no | Show explicit message |
| unborn branch | no | no | Show explicit message |
| no-upstream | no | yes | Push sets upstream; show remote/branch preview |
| gone-upstream | no | no | Upstream deleted; show explicit message |
| in-sync | no | no | Both disabled; show up-to-date message |
| ahead | no | yes | Local commits to push |
| behind | yes | no | Remote commits to pull |
| diverged | yes | yes | Both enabled; warn before push |
| pull in-flight | no | no | Both disabled during operation |
| push in-flight | no | no | Both disabled during operation |
| pull success | no | no | Snapshot refresh triggered; transient success message |
| push success | no | no | Snapshot refresh triggered; transient success message |
| pull error | no | yes | Show raw stderr; re-enable push |
| push error | yes | no | Show raw stderr; re-enable pull |

Acceptance criteria:

- branch state and sync actions stay visually connected
- risky states remain explicit before the user acts
- raw stderr is always shown on error — never replaced with a generic message
- the shell still feels like one coherent tool instead of separate sync dialogs
- a snapshot refresh is triggered automatically after a successful pull or push

Verification:

- state-matrix walkthrough for all rows above
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
