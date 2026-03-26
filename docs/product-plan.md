# Product Plan

## Purpose

This document is the working plan for turning `an-dr-git` into a modern cross-platform Git client for Windows and Linux.

It combines inputs from the current team model:

- product-manager: vision, scope, sequencing
- architect: technical phases and non-negotiable constraints
- ui-designer and ux-designer: interface quality bar and workflow design
- tester: verification strategy and release gates
- reviewer: failure modes, drift signals, and open questions

This is the internal execution plan. A stakeholder-facing summary lives in `docs/stakeholder-brief.md`.

## Product Vision

`an-dr-git` should become a high-trust desktop Git client for technical users who want the clarity and productivity of tools like SmartGit without sacrificing Git truth.

The product vision is:

- present repository state clearly and fast
- make branches, diffs, and sync operations the core experience
- stay faithful to native Git behavior instead of abstracting it away
- feel like a premium developer tool rather than a generic admin shell
- remain cross-platform and AI-friendly to develop over time

## Project Philosophy

The canonical philosophy lives in `PHILOSOPHY.md`.

It drives product direction and team behavior.

## Product Positioning

The product should sit in this space:

- more visual and integrated than CLI workflows alone
- more honest about Git state than simplified beginner tools
- lighter in scope than full enterprise IDE workflows
- more modern and intentional in UI quality than many traditional Git clients

Primary users:

- users similar to SmartGit's audience: technical Git users who already understand core Git concepts
- individual developers who work across multiple repositories
- power users who want dense repository visibility and trustworthy sync workflows

## Product Principles

1. Git is the source of truth.
2. Core workflows must be correct before the product grows wider.
3. The UI must be modern and high quality, but never decorative at the expense of clarity.
4. Raw Git output must always be available when structured parsing is incomplete.
5. The app must optimize for trust, readability, and speed on real repositories.

## Strategic Scope

### Phase 1 Product Scope

The first product slice must deliver these complete workflows:

- open a local repository
- inspect the repository tree
- inspect local and remote branches
- inspect diffs based on native `git diff`
- push safely
- pull safely with `--ff-only`
- report clearly when system Git is missing

### Deferred From The First Slice

These are explicitly out of scope until the core is stable:

- commit authoring
- staging and partial staging
- merge conflict resolution
- rebase and cherry-pick
- stash, tags, and history browser
- submodule and worktree management
- bundled Git and custom credential storage

## Delivery Strategy

The roadmap is intentionally phased so each milestone delivers a usable vertical slice instead of disconnected infrastructure.

### Phase 0: Foundations

Goal:

Create the runtime and process boundaries that every later feature depends on.

Deliverables:

- Electron shell
- system Git detection
- typed IPC contracts
- repository open flow
- per-repository operation queue
- structured logging
- initial repository snapshot model
- repository-session model that is compatible with future same-window tabs

Exit criteria:

- the app can open a local repo and confirm Git availability
- the app reports clearly that Git must be installed when it is missing
- renderer does not call Git or filesystem APIs directly
- command execution is stable on Windows and Linux
- failure states show enough raw detail to debug

Primary owners:

- product-manager for scope and sequencing
- architect for process boundaries
- developer for implementation
- tester for integration checks
- reviewer for architecture-fit review

### Phase 1: Tree And Branches

Goal:

Make repository state legible at a glance.

Deliverables:

- repository tree based on Git-visible files
- local and remote branch listing
- current branch state
- upstream state, ahead/behind, detached HEAD, unborn branch handling
- refresh orchestration and watcher-driven update flow
- dense but readable panel layout

Exit criteria:

- tree state matches Git output for tracked, untracked, renamed, deleted, and ignored cases
- branch panel accurately reflects detached, unborn, and missing-upstream states
- refresh behavior is predictable and debounced
- layout supports fast scanning on real repositories

Primary owners:

- architect for snapshot boundaries
- developer for repository and branch services
- ux-designer for navigation and information hierarchy
- ui-designer for the visual system
- tester and reviewer for state accuracy

### Phase 2: Diff Experience

Goal:

Turn raw `git diff` output into a readable, high-trust inspection tool.

Deliverables:

- native diff command pipeline
- structured parser for supported unified diff output
- raw-output fallback
- modern file/hunk/line diff viewer
- binary, rename, copy, and mode-change handling

Exit criteria:

- diff view stays useful when parsing is partial
- binary and large diff cases are surfaced safely
- diff readability is strong enough to be a product strength, not a checkbox
- raw Git output remains accessible in every unsupported case

Primary owners:

- architect for parser boundaries
- developer for execution and parser implementation
- ui-designer for diff readability and typography
- ux-designer for interaction flow and fallback clarity
- tester for scenario coverage
- reviewer for edge-case risk review

### Phase 3: Sync Operations

Goal:

Add safe write operations without reducing user trust.

Deliverables:

- push flow
- pull flow using `git pull --ff-only`
- upstream detection
- first-push setup flow
- explicit progress, warning, and error states
- clear raw stderr access for failures

Exit criteria:

- push and pull behavior matches Git semantics
- missing upstream and rejected push cases are explained clearly
- non-fast-forward pull is not hidden or normalized away
- write operations remain serialized per repository

Primary owners:

- product-manager for workflow scope
- architect for operation safety rules
- developer for sync service
- ux-designer for action flows
- tester for cross-platform verification
- reviewer for failure-path review

### Phase 4: Quality Pass For MVP

Goal:

Turn the functional MVP into a polished product.

Deliverables:

- cohesive design system
- same-window repository switching with tabs
- refined keyboard navigation
- panel resizing and density tuning
- improved empty, loading, stale, and error states
- performance work for large repositories
- validation against messy real-world repositories

Exit criteria:

- the UI feels deliberate and distinctive
- repository tabs work cleanly without confusing repository state ownership
- large repositories remain usable
- keyboard workflows are practical
- error and partial states are easy to understand

Primary owners:

- ui-designer for visual polish
- ux-designer for interaction refinement
- developer for performance and implementation adjustments
- tester for large-repo and platform checks
- reviewer for final quality assessment

### Phase 5: Post-MVP Expansion

Goal:

Add advanced Git workflows only after the base model is proven.

Candidate areas:

- history and search
- merge and rebase support
- commit authoring
- staging and partial staging
- stash and tags
- submodules and worktrees
- multi-window or multi-repository workflows

Rule:

No expansion feature starts until tree, branches, diff, push, and pull are stable on real repositories.

## UX And UI Plan

The product should not ship as a generic component-library application.

### UX Direction

- repository, branch, and diff state should be understandable in seconds
- keyboard usage should be first-class
- warnings should explain risk without hiding Git semantics
- loading, refresh, and stale states should be visible and predictable
- expert users should be able to scan dense information quickly
- switching between repositories in the same window should feel lightweight and obvious

### UI Direction

- create a strong three-zone layout: tree, branches/status, diff
- use a purposeful typography system suitable for both metadata and code
- keep color and motion restrained but distinctive
- optimize diff readability as a signature surface
- use a minimal, clear visual direction with stronger separation between areas than white cards and thin gray borders
- ship a light-theme MVP first
- make the accent color configurable
- defer dark theme until after the MVP core is stable

### Design Deliverables

- shell layout and navigation model
- repo-tab model and tab states
- design tokens for type, color, spacing, and motion
- component guidance for tree, branch rows, diff sections, warnings, and operation state
- interaction spec for keyboard navigation and sync actions

## Team Operating Model For Planning

### Product Manager

- owns roadmap quality
- slices work into milestones and vertical increments
- protects scope

### Architect

- guards app boundaries and major technical decisions
- keeps Git truth, IPC discipline, and runtime safety intact

### Developer

- implements the smallest reliable slice that satisfies the phase
- avoids speculative infrastructure

### UI Designer

- owns visual quality and consistency
- protects against generic, template-like output

### UX Designer

- owns flow clarity, density, and expert efficiency
- translates Git complexity into understandable workflows

### Tester

- defines verification by phase
- keeps release readiness tied to real Git scenarios

### Reviewer

- identifies drift, weak assumptions, and missing coverage
- checks that execution still matches the product intent

## Verification Strategy

### Verification By Phase

- Phase 0: repository open, Git detection, IPC validation, operation queue behavior
- Phase 1: tree and branch accuracy across normal and edge repository states
- Phase 2: diff parsing, raw fallback, binary cases, rename/mode-change behavior, large diff handling
- Phase 3: push, pull, upstream creation, auth failures, rejection handling, timeout and cancellation behavior
- Phase 4: performance, visual clarity, keyboard flow, and real-world repository validation

### Release Gates

The MVP is not ready until:

- Windows and Linux integration checks pass with real Git-backed repositories
- core flows are tested against detached HEAD, unborn branches, missing upstreams, and dirty trees
- diff fallback behavior is proven, not assumed
- no failure path hides raw stderr
- renderer boundaries stay clean and validated
- large repository behavior is acceptable under virtualization and debounced refresh

## Risk Register

### Product Risks

- the product looks modern but is too slow or shallow for real Git users
- the UI becomes generic and loses differentiation
- feature breadth expands before the core is trusted

### Technical Risks

- system Git availability and version variance
- cross-platform process execution differences
- repository watcher noise or stale state
- diff parser edge cases
- Windows path, lock, and CRLF behavior
- large repository performance

### UX Risks

- hiding Git complexity too aggressively
- overloading screens before core context is clear
- weak keyboard navigation
- poor visibility of error and partial states

### Mitigations

- keep Git CLI authoritative
- keep raw output available
- test with real repos on both platforms
- gate advanced features behind core stability
- review UX/UI quality as part of every phase, not only at the end

## Open Questions

These questions need explicit decisions before implementation expands:

1. Should repository tabs land inside the MVP quality pass or immediately after MVP if core flows need more stabilization time?
2. What minimum diff rendering quality counts as acceptable before raw fallback takes over?
3. How should detected submodules, worktrees, and nested repos be communicated before they are fully supported?
4. Should `pull --ff-only` remain the long-term default, or become a configurable sync strategy later?

## Drift Signals

If these appear, the project is moving in the wrong direction:

- code starts re-implementing Git logic instead of orchestrating Git CLI behavior
- UI becomes dashboard-like instead of tool-like
- new features land before tree, branch, diff, and sync quality is stable
- raw stderr becomes hidden behind generalized error messages
- role boundaries blur and planning, design, implementation, and review collapse into one stream without checkpoints

## Immediate Next Planning Steps

1. Roadmap and MVP boundary approved by the main stakeholder.
2. Convert Phase 0 into an implementation backlog in `docs/phase-0-plan.md`.
3. Create the first shell, repository session, and IPC contracts.
4. Create the shell layout, navigation, repo-tab model, and design-token brief before detailed UI implementation begins.
