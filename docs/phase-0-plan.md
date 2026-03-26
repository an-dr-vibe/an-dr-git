# Phase 0 Plan

## Purpose

This document turns Phase 0 from a milestone into an executable backlog.

Phase 0 is the foundations phase. Its job is to create the runtime, workflow, and safety boundaries that every later feature depends on.

Status:

- Completed on March 26, 2026.

This phase is complete only when:

- the app shell exists
- the system `git` executable is detected reliably
- a repository can be opened through the main process
- the renderer uses typed IPC only
- write operations are serialized per repository
- logging and verification are in place

## Phase Rule

Every slice in Phase 0 must end in a buildable, runnable, verifiable artifact that the stakeholder can test.

If a slice cannot produce that outcome, it should be split again.

## Phase Goal

Create a tab-ready, single-window desktop shell with a safe main/renderer boundary, system Git detection, repository open flow, operation queue, logging, and the first repository session model.

## Non-Goals

Do not expand into these during Phase 0:

- repository tree rendering
- branch listing
- diff rendering
- push and pull
- dark theme
- multi-window support
- advanced Git operations

## Deliverables

Phase 0 must deliver:

- Electron + Vite + TypeScript scaffold
- lint, typecheck, unit test, integration test, and coverage wiring
- typed IPC contract layer
- system Git detection flow
- repository open flow
- repository session model
- per-repository operation queue
- structured logging
- shell layout with placeholder zones and tab-ready session container
- packaging pipeline with repo-local runnable artifacts and platform installers

## Backlog Order

### Slice 0.1: Tooling Scaffold — Done

Goal:

Create the project skeleton and quality tooling.

Deliverables:

- `package.json`
- Electron/Vite/TypeScript project structure
- Vitest setup
- lint and typecheck setup
- coverage output compatible with `scripts/coverage-gate.ps1`
- package scripts:
  - `lint`
  - `typecheck`
  - `test:unit`
  - `test:integration`

Acceptance criteria:

- `pwsh ./scripts/quality-gate.ps1` runs against the scaffold without special-case failure
- TypeScript builds successfully
- the repo has a consistent source layout matching the architecture

Verification:

- quality gate passes
- baseline tests execute and produce coverage output

### Slice 0.2: App Shell — Done

Goal:

Create the first working desktop shell with clear process boundaries.

Deliverables:

- Electron main process entry
- renderer entry
- preload bridge
- initial shell window
- placeholder layout zones for future tree, branches, and diff areas
- same-window session container designed so tabs can be added without reworking the shell

Acceptance criteria:

- the app launches on Windows and Linux
- renderer cannot access Node/Git APIs directly
- shell layout is stable and visible

Verification:

- manual launch verification
- preload/API boundary tests where practical

### Slice 0.3: Typed IPC Contracts — Done

Goal:

Establish a stable communication contract between renderer and main.

Deliverables:

- shared contract definitions in `src/shared`
- runtime validation for IPC payloads
- request/response pattern for initial app actions
- error shape for user-visible failures

Acceptance criteria:

- renderer-to-main messages are typed and validated
- invalid payloads fail clearly
- no repository action bypasses IPC

Verification:

- unit tests for contract validation
- integration tests for IPC happy-path and invalid-payload cases

### Slice 0.4: System Git Detection — Done

Goal:

Detect and validate the system `git` executable.

Deliverables:

- `GitExecutableResolver`
- version check flow
- missing-Git error model
- UI state that reports Git must be installed if missing

Acceptance criteria:

- the app detects Git on supported environments
- the app fails clearly when Git is missing or unusable
- the renderer receives structured detection status

Verification:

- integration tests using real `git`
- negative-path test for missing executable handling
- manual verification of user-facing message

### Slice 0.5: Repository Open Flow — Done

Goal:

Open a local repository through the main process and validate that it is usable.

Deliverables:

- repository selection/open action
- path validation
- Git-backed repository check
- initial repository identity model
- failure states for invalid, missing, or inaccessible paths

Acceptance criteria:

- a valid repository can be opened from the shell
- invalid paths and non-repositories fail clearly
- the opened repository is represented as a session-owned entity

Verification:

- integration tests with real local repos
- manual verification of valid and invalid open flows

### Slice 0.6: Repository Session Model — Done

Goal:

Create the first long-lived repository session abstraction.

Deliverables:

- `RepositorySession`
- `RepositoryRegistry`
- repository identity state
- session lifecycle: create, activate, close
- tab-ready session container behavior without requiring tab UI completion

Acceptance criteria:

- the app can maintain repository state through a session object
- session ownership is explicit and isolated
- the shell is structurally ready for same-window tabs later

Verification:

- unit tests for session lifecycle
- integration tests for open/activate/close behavior

Implemented:

- `RepositorySession` now owns lifecycle state and the per-repository operation queue entry point
- `RepositoryRegistry` now supports create/reactivate, list, activate-by-session, and close behavior
- reopening the same repository reuses the existing session identity

### Slice 0.7: Operation Queue And Logging — Done

Goal:

Create the execution safety layer for repository actions.

Deliverables:

- per-repository operation queue
- read/write operation classification
- structured logging with command, args, duration, exit code, and repository context
- error propagation model

Acceptance criteria:

- write operations cannot overlap inside one repository session
- failures are logged and passed upward clearly
- structured logs exist for Git execution attempts

Verification:

- unit tests for queue behavior
- integration tests for serialized write execution

Implemented:

- repository sessions now own a write-serializing operation queue
- Git detection and repository-open commands emit structured log records
- command logs include command, args, working directory, duration, exit code, timeout state, and repository context

### Slice 0.8: Foundation UX/UI Pass — Done

Goal:

Make the shell usable enough that Phase 1 work can land cleanly.

Deliverables:

- minimal light-theme shell styling
- placeholder states for no repo, missing Git, invalid repo, and loading
- first-pass shell layout hierarchy
- basic keyboard focus behavior

Acceptance criteria:

- shell states are visually distinct and understandable
- missing-Git and no-repo states are readable and not generic
- layout supports later tree/branch/diff composition without redesigning the frame

Verification:

- state-matrix walkthrough
- keyboard verification
- visual review against the product direction

Implemented:

- the renderer now exposes an explicit Phase 0 state matrix covering startup, Git attention, no-repo, open-in-progress, opened, invalid-path/repository, and unexpected-error states
- shell copy and cards distinguish no-repo, Git-required, and repository-error conditions instead of collapsing them into one generic placeholder
- the session container and panel frame remain tab-ready without requiring a redesign for Phase 1

### Slice 0.9: Packaging And Verification Artifacts — Done

Goal:

Create distributable installers and predictable local build artifacts that stakeholders can run directly.

Deliverables:

- Electron Forge packaging configuration
- repo-local packaged app output under a predictable artifacts directory
- Windows installer output
- Debian installer output configuration
- package scripts for packaging, making installers, and artifact verification

Acceptance criteria:

- `npm run package:verify` produces a repo-local packaged application artifact and smoke-launches it successfully
- `npm run make:verify:win` produces a Windows installer artifact on Windows
- `npm run make:verify:deb` produces a Debian installer artifact on Linux or another supported host with the required packaging tools
- artifact output paths are predictable and documented

Verification:

- local packaged-app smoke verification
- local Windows installer verification on Windows
- Debian installer verification on a supported Linux packaging host, or an explicit note when that host is unavailable

## Dependency Order

The slices depend on each other in this order:

1. Tooling Scaffold
2. App Shell
3. Typed IPC Contracts
4. System Git Detection
5. Repository Open Flow
6. Repository Session Model
7. Operation Queue And Logging
8. Foundation UX/UI Pass
9. Packaging And Verification Artifacts

Notes:

- Slice 0.8 can begin in parallel once the shell exists, but should finalize after the key states are real.
- Repository Session Model and Operation Queue should be designed together even if delivered separately.

## Acceptance Gate For Phase 0

Phase 0 is done only when all of these are true:

- `pwsh ./scripts/quality-gate.ps1` passes
- the app launches successfully on Windows and Linux
- the renderer communicates with the main process only through validated IPC
- system Git is detected or a clear install-required message is shown
- a valid repository can be opened
- invalid repository paths fail with a clear message
- repository sessions are explicit and tab-ready
- write operations are serialized per repository
- structured logging exists for command execution and failures
- repo-local packaged app artifacts can be generated and run for verification
- Windows and Debian installer pipelines are configured and documented

Completion audit:

- shell exists, launches, and preserves the typed preload boundary
- system Git detection is structured and logged
- repository open validates path, repository root, git-dir, and HEAD state through the main process
- repository sessions are explicit, reusable, and closable
- per-repository write serialization exists as session-owned infrastructure
- the renderer explicitly surfaces the required shell state matrix
- repo-local packaged artifacts and installer entry points remain in place

## Test Plan For Phase 0

### Unit Tests

- IPC contract validation
- Git detection result mapping
- repository session lifecycle
- operation queue serialization

### Integration Tests

- open valid repo
- reject invalid repo
- reject missing path
- detect system Git
- missing-Git handling
- queue behavior for overlapping operations

### Manual Checks

- app launches
- missing-Git message is understandable
- no-repo state is understandable
- valid repo open flow works
- invalid repo flow is clear

## UI State Matrix For Phase 0

The shell must explicitly support:

- app starting
- Git detection in progress
- Git missing
- no repository selected
- repository open in progress
- repository opened
- invalid repository
- unexpected error

## Risks In This Phase

- scaffolding too much infrastructure before the first usable flow exists
- weak process boundaries between renderer and main
- Git detection that works only on one platform shape
- session model that blocks later same-window tab support
- documentation and automation lagging behind the scaffold

## Mitigations

- keep each slice vertically testable
- prefer explicit contracts over hidden convenience APIs
- validate against real `git` as soon as possible
- keep shell UI minimal but state-complete
- require docs and automation updates in the same change sets

## Suggested Execution Sequence

If implementation starts now, the first concrete order should be:

1. scaffold the app and package scripts
2. wire the quality gate into the real project
3. create the shell window and preload boundary
4. add typed shared contracts and IPC validation
5. implement system Git detection
6. implement repository open flow
7. add repository session and operation queue
8. finish the Phase 0 shell states and usability pass
