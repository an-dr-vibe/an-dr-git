# Phase 2 Plan

## Purpose

This document turns Phase 2 from a milestone into an executable backlog.

Phase 2 is the diff-experience phase. Its job is to turn the Phase 1 repository-state layer into a trustworthy diff inspection surface without weakening the existing main/renderer boundary.

This phase is complete only when:

- the app can request Git-backed diff documents through typed IPC
- the diff pipeline preserves raw output for unsupported cases
- the renderer can read structured file, hunk, and line data for supported unified diffs
- binary, rename, copy, and mode-change cases stay explicit instead of being flattened away
- the delivered artifact lets a stakeholder open a repo, select a file, and inspect a real diff immediately

## Status

Phase 2 is planned next as of March 26, 2026.

Phase 1 is complete and now provides the active repository snapshot, tree selection context, branch context, and debounced refresh model this phase depends on.

## Phase Goal

Deliver the first trustworthy diff experience: Git execution, structured parsing, raw fallback, and readable presentation inside the existing three-panel shell.

## Non-Goals

Do not expand into these during Phase 2:

- push and pull actions
- commit authoring or staging controls
- branch comparison workflows beyond the command-path preparation
- syntax highlighting, blame, or history browsing
- custom merge or conflict-resolution UI

## Deliverables

Phase 2 must deliver:

- shared diff domain types under `src/shared`
- typed IPC request/response for diff reads
- main-process diff service using native `git diff` output
- unified diff parser for the supported subset
- raw-output fallback for unsupported or partially parsed cases
- renderer diff panel with file, hunk, and line rendering
- binary, rename, copy, mode-change, and no-newline markers surfaced explicitly
- selection wiring from the Phase 1 tree panel into the diff panel

## Backlog Order

### Slice 2.1: Diff Contracts

Goal:

Define the shared diff document model and typed IPC surface.

Deliverables:

- `DiffDocument`
- `DiffFile`
- `DiffHunk`
- `DiffLine`
- diff request/response contracts and runtime validation

Acceptance criteria:

- renderer can request diff data only through validated IPC
- raw diff text remains available alongside parsed structures
- supported and unsupported diff states are distinguishable without guessing

Verification:

- unit tests for diff contract validation
- integration test for diff IPC happy path and invalid-payload handling

### Slice 2.2: Native Diff Command Pipeline

Goal:

Execute native Git diff commands from the main process without hiding Git semantics.

Deliverables:

- diff service using `git diff --no-ext-diff --submodule=short --find-renames --find-copies`
- selection-aware diff requests for working tree files
- command result capture with raw stdout and stderr

Acceptance criteria:

- Git command args stay explicit and shell-free
- stderr is preserved when diff generation fails
- the service can request diffs for selected files without renderer-side filesystem access

Verification:

- unit tests for request-to-command mapping
- integration tests with modified, deleted, and renamed files

### Slice 2.3: Unified Diff Parser

Goal:

Parse the supported subset of unified diff output into a readable internal model.

Deliverables:

- parser for file headers, hunks, and line markers
- explicit binary and unsupported markers
- raw fallback preservation when parsing is partial

Acceptance criteria:

- file sections, hunks, and line additions/removals are preserved in order
- binary files do not pretend to be text
- parser failures do not discard raw Git output

Verification:

- unit tests for ordinary diffs, no-newline markers, renames, binary markers, and partial-parse fallback

### Slice 2.4: Diff Panel UI

Goal:

Replace the Phase 1 diff placeholder with a real inspection surface.

Deliverables:

- diff panel states for empty, loading, error, binary, raw-fallback, and parsed-diff modes
- file header, hunk header, and line rendering
- selection wiring from the tree panel
- copy that explains fallback and unsupported cases without hiding Git truth

Acceptance criteria:

- the panel remains readable for ordinary single-file diffs
- raw fallback stays one click away or already visible when parsing is unsupported
- the shell still feels like one coherent tool instead of a bolted-on diff view

Verification:

- state-matrix walkthrough for diff states
- manual keyboard verification for tree-to-diff navigation
- screenshot or manual visual verification on a real repository

### Slice 2.5: Artifact And Review Gate

Goal:

Ship Phase 2 as a stakeholder-usable build, not just code.

Deliverables:

- updated docs for diff workflows and fallback behavior
- fresh packaged artifact under `artifacts/forge/`
- review of parser and fallback risks plus known gaps

Acceptance criteria:

- `pwsh ./scripts/quality-gate.ps1` passes
- `npm run package:verify` succeeds on supported hosts
- the delivered artifact opens a repository, selects a file, and renders either a structured diff or explicit raw fallback

Verification:

- quality gate output
- packaged-app verification output
- concise reviewer findings log or explicit note that no blocking findings were found

## Dependency Order

The slices depend on each other in this order:

1. Diff Contracts
2. Native Diff Command Pipeline
3. Unified Diff Parser
4. Diff Panel UI
5. Artifact And Review Gate

Notes:

- The command pipeline and parser can overlap once the diff contracts are stable.
- UI layout work can start early, but renderer wiring should wait until the request/response model is settled.

## Acceptance Gate For Phase 2

Phase 2 is done only when all of these are true:

- diff data can be requested through typed IPC
- structured parsing covers the supported unified diff subset
- raw fallback stays available whenever parsing is partial or unsupported
- binary and rename-oriented cases are surfaced explicitly
- the renderer remains Git- and filesystem-isolated
- a fresh packaged artifact exists for stakeholder verification

## Test Plan For Phase 2

### Unit Tests

- diff contract validation
- command mapping
- parser coverage for normal and edge diff forms
- raw fallback branching

### Integration Tests

- open repository, select modified file, and request diff
- deleted file diff
- rename diff
- binary diff
- parser fallback on unsupported syntax

### Manual Checks

- diff readability for ordinary code changes
- keyboard flow from tree selection into diff inspection
- raw-fallback visibility and copy clarity
- empty/loading/error/binary states

## Risks In This Phase

- parsing too aggressively and misrepresenting real Git output
- letting raw fallback degrade into a hidden debugging-only feature
- binary and rename cases being flattened into misleading text views
- a visually dense diff panel becoming hard to scan

## Mitigations

- keep raw Git output attached to every diff document
- scope the parser to the supported subset rather than pretending to parse everything
- surface binary and fallback states explicitly in the UI
- validate typography, spacing, and panel density on real repository changes before closing the phase
