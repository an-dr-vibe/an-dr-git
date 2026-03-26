# Phase 1 Plan

## Purpose

This document turns Phase 1 from a milestone into an executable backlog.

Phase 1 is the repository-state phase. Its job is to make the currently opened repository legible at a glance without weakening the Phase 0 boundaries.

This phase is complete only when:

- the app can build a repository snapshot from Git CLI output
- the renderer can request and refresh that snapshot through typed IPC
- the tree panel reflects tracked, untracked, deleted, and ignored file states
- the branch panel reflects local and remote branches plus current-branch state
- refresh behavior is predictable after open and after filesystem hints

## Phase Goal

Deliver the first trustworthy repository overview: tree, branches, current-branch state, and refresh orchestration inside the existing shell.

## Non-Goals

Do not expand into these during Phase 1:

- diff rendering
- push and pull actions
- commit authoring or staging
- multi-window support
- advanced watcher heuristics beyond simple debounced refresh hints

## Deliverables

Phase 1 must deliver:

- repository snapshot domain types under `src/shared`
- typed IPC request/response for repository snapshot reads and refresh
- snapshot builder based on native Git CLI output
- branch service for local and remote refs plus upstream/ahead/behind state
- tree service for tracked and untracked file visibility
- debounced watcher-driven refresh hints
- renderer state for loading, stale, empty, dense-data, and error cases
- tree and branch panel rendering inside the existing shell

## Backlog Order

### Slice 1.1: Snapshot Contracts

Goal:

Define the shared repository snapshot model and typed IPC surface.

Deliverables:

- `RepositorySnapshot`
- `BranchSummary`
- `TreeNode`
- snapshot IPC contracts and runtime validation

Acceptance criteria:

- renderer can request snapshot data only through validated IPC
- snapshot contracts are explicit about detached HEAD, unborn branch, and upstream state
- future diff and sync slices can extend the snapshot without breaking current consumers

Verification:

- unit tests for shared contract validation
- integration test for snapshot IPC happy-path and invalid-payload handling

### Slice 1.2: Tree Snapshot Builder

Goal:

Build a Git-visible file tree rather than a plain filesystem walk.

Deliverables:

- status parsing for `git status --porcelain=v2 -z --branch`
- tracked-file merge using `git ls-files -z`
- untracked-file merge using `git ls-files --others --exclude-standard -z`
- virtual tree-node assembly

Acceptance criteria:

- tracked, modified, deleted, and untracked files appear in the tree model
- ignored files are either hidden or explicitly marked by Git-backed logic, never guessed from raw filesystem state alone
- directories are represented virtually so the tree can scale later

Verification:

- unit tests for status parsing and tree mapping
- integration tests with temporary repositories covering modified, deleted, untracked, and ignored files

### Slice 1.3: Branch Snapshot Builder

Goal:

Expose branch truth clearly and safely.

Deliverables:

- branch discovery via `git for-each-ref`
- current-branch detection
- upstream, ahead/behind, detached HEAD, unborn branch, and gone-upstream mapping

Acceptance criteria:

- local and remote-tracking branches are distinct in the snapshot
- detached HEAD and unborn branch states are explicit
- ahead/behind counts and missing-upstream state are preserved exactly

Verification:

- unit tests for branch mapping
- integration tests with fixture repos covering upstream, detached, unborn, and gone-upstream states

### Slice 1.4: Snapshot Refresh Workflow

Goal:

Keep repository state current without treating watcher events as truth.

Deliverables:

- main-process snapshot read service
- manual refresh entry point
- watcher registration for `.git/HEAD`, `.git/index`, `.git/refs`, and working-tree hints
- debounced refresh scheduling per repository session

Acceptance criteria:

- opening a repository produces an initial snapshot automatically
- refresh requests do not overlap dangerously with later write operations
- noisy watcher bursts trigger a bounded number of Git refreshes

Verification:

- unit tests for refresh scheduling and debounce behavior
- integration tests proving refresh after HEAD and worktree changes

### Slice 1.5: Tree And Branch UI

Goal:

Replace placeholders in the tree and branch panels with real repository-state rendering.

Deliverables:

- renderer snapshot store
- panel states for loading, empty, dense-data, stale, and error
- clickable tree and branch rows prepared for later diff interaction
- keyboard focus behavior for tree and branch navigation

Acceptance criteria:

- tree and branch panels remain readable with dense repository data
- edge states are visually distinct and copy is explicit
- the shell frame from Phase 0 does not require redesign to host the real data

Verification:

- state-matrix walkthrough for both panels
- keyboard verification
- screenshot or manual visual verification on real repositories

### Slice 1.6: Artifact And Review Gate

Goal:

Ship Phase 1 as a stakeholder-usable build, not just code.

Deliverables:

- updated docs for repository overview workflows
- fresh packaged artifact under `artifacts/forge/`
- review of Phase 1 correctness risks and known gaps

Acceptance criteria:

- `pwsh ./scripts/quality-gate.ps1` passes
- `npm run package:verify` succeeds on supported hosts
- the delivered artifact opens a repository and renders real tree and branch data

Verification:

- quality gate output
- packaged-app verification output
- concise reviewer findings log or explicit note that no blocking findings were found

## Dependency Order

The slices depend on each other in this order:

1. Snapshot Contracts
2. Tree Snapshot Builder
3. Branch Snapshot Builder
4. Snapshot Refresh Workflow
5. Tree And Branch UI
6. Artifact And Review Gate

Notes:

- Tree and branch builders can progress in parallel once the snapshot contracts exist, but they should integrate behind one snapshot service.
- UI work should start early on layout fit, but final wiring should wait until snapshot contracts are stable.

## Acceptance Gate For Phase 1

Phase 1 is done only when all of these are true:

- a repository snapshot can be requested through typed IPC
- tree state matches Git output for tracked, modified, deleted, untracked, and ignored cases
- branch state matches Git output for local, remote, detached, unborn, and missing-upstream cases
- refresh behavior is explicit and debounced
- the renderer remains Git- and filesystem-isolated
- a fresh packaged artifact exists for stakeholder verification

## Test Plan For Phase 1

### Unit Tests

- snapshot contract validation
- status parsing
- tree assembly
- branch mapping
- refresh debounce behavior

### Integration Tests

- open repository and load initial snapshot
- modified, deleted, renamed, untracked, and ignored files
- detached HEAD
- unborn branch
- branch tracking and ahead/behind cases
- watcher-triggered refresh

### Manual Checks

- dense repository tree readability
- branch panel clarity
- keyboard navigation through tree and branch lists
- stale/loading/error state behavior

## Risks In This Phase

- relying on filesystem walks that drift from Git truth
- parsing too little branch metadata and losing edge-case clarity
- watcher noise causing stale or thrashing UI
- dense repository data turning the shell into a generic table layout

## Mitigations

- keep Git CLI authoritative for repository state
- preserve raw Git output for debugging when parsing is incomplete
- debounce watcher hints and re-read state through Git
- validate layout and copy against dense real repositories before closing the phase
