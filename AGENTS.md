# AGENTS

## Purpose

This file is the repo-level operating manual for AI agents working on `an-dr-git`.

It defines:

- product direction
- technical constraints
- architecture boundaries
- team orchestration
- delivery workflow
- quality gates

Role behavior belongs in `.agents/*.instruciton.md`. Those files must stay generic and role-focused. Repo-specific knowledge stays here.

## Product Summary

`an-dr-git` is a cross-platform desktop Git client for Windows and Linux.

Current target feature set:

- repository tree
- branch list and state
- push
- pull
- diff viewer based on native `git diff` output

Primary reference:

- `docs/architecture.md`

## Core Decisions

1. Use a single-language stack: TypeScript.
2. Use Electron for the desktop runtime.
3. Use the system `git` executable as the authoritative backend.
4. Prefer safe, explicit Git workflows over feature breadth.
5. Preserve raw Git output for debugging and unsupported cases.

## Non-Goals For The Current Phase

- implementing every Git feature
- custom authentication flows
- custom merge or rebase engine
- libgit2 bindings
- direct renderer access to filesystem or Git execution

## Initial Source Layout

Target layout once implementation starts:

```text
docs/
.agents/
src/
  main/
  renderer/
  shared/
tests/
```

## Orchestration Model

The main agent reads this file first and acts as the orchestrator.

### Order Of Work

1. Read `docs/architecture.md` before changing design-critical code.
2. Pick the smallest role set needed for the task.
3. Delegate role-specific work by loading the relevant `.agents/*.instruciton.md` files.
4. Merge outputs against the architecture rather than letting roles invent local standards.
5. Verify behavior with tests or an explicit explanation of what could not be verified.

### Team Roles

- `.agents/product-manager.instruciton.md`
- `.agents/architect.instruciton.md`
- `.agents/developer.instruciton.md`
- `.agents/tester.instruciton.md`
- `.agents/reviewer.instruciton.md`
- `.agents/ui-designer.instruciton.md`
- `.agents/ux-designer.instruciton.md`

### Invocation Guidance

Use `product-manager` when:

- scope needs to be shaped into milestones, slices, or priorities
- multiple valid implementation paths exist and sequencing needs to be decided
- planning, acceptance framing, or cross-role coordination is the main problem

Use `architect` when:

- a feature changes app boundaries
- a new workflow crosses main, renderer, and shared layers
- a tradeoff affects long-term maintainability

Use `developer` when:

- implementation work is needed
- code must be added, changed, or refactored
- Git behavior, desktop runtime, or renderer concerns must be translated into working code

Use `tester` when:

- acceptance criteria, test cases, fixtures, and verification strategy are needed
- regression risk needs to be assessed before or after implementation

Use `reviewer` when:

- the implementation is complete enough for critical review
- bugs, regressions, unsafe assumptions, and missing coverage need to be identified

Use `ui-designer` when:

- visual direction, layout language, typography, spacing, or component aesthetics need to be defined
- the interface risks looking generic, dated, or inconsistent

Use `ux-designer` when:

- workflow clarity, information hierarchy, interaction flow, or task friction need to be improved
- Git complexity must be translated into understandable user flows

## Shared Development Rules

### Architecture

- Main process owns Git execution and repository state coordination.
- Renderer consumes typed IPC contracts only.
- Shared domain types live in `src/shared`.
- Write operations are serialized per repository.

### Git Rules

- Prefer Git CLI commands over custom state inference.
- Never silently transform Git behavior.
- Never hide stderr when a command fails.
- Do not implement credential storage.
- Assume `.git` may be a file, not a directory.

### UX Rules

- Show exact repository state before offering actions.
- Favor raw-output fallback over incomplete rendering.
- Prefer `pull --ff-only` in this phase.
- Do not imply success until Git has actually completed.
- Modern polish is required, but never at the cost of clarity or accuracy.

### UI Rules

- The app should feel like a professional developer tool, not a template.
- Use a deliberate visual system for typography, spacing, color, and motion.
- Optimize diff readability and dense information scanning.
- Keep styling consistent across Windows and Linux without flattening the product identity.

### Code Rules

- Keep modules narrow and explicit.
- Use runtime validation at process boundaries.
- Avoid framework-heavy abstractions before repeated patterns exist.
- Optimize for clarity that AI agents can maintain.

## Delivery Workflow

For any non-trivial task:

1. use `product-manager` to frame the task in terms of milestone, scope, and priority when planning is needed
2. restate the task in terms of the current milestone
3. identify impacted modules
4. consult the relevant role files
5. implement the smallest vertical slice that can be tested
6. verify with unit, integration, or manual evidence
7. document any architectural deviation in `docs/architecture.md`

## Definition Of Done

A task is done when:

- the implementation matches the current architecture
- error paths are handled explicitly
- tests cover the new behavior or the gap is clearly documented
- user-visible failures include enough context to debug
- docs are updated when contracts or operating rules change

## Decision Log Rules

When a code change introduces a material architectural decision, update `docs/architecture.md` in the same change set.

Examples:

- new IPC contracts
- new repository snapshot fields
- changed Git command strategy
- new background task model

## Current Development Priorities

1. app shell and system Git detection
2. repository snapshot model
3. file tree and branch list
4. diff parsing and rendering
5. push and pull flows
6. cohesive UI system and UX patterns for repository navigation

## Planning Ownership

`product-manager` owns planning quality for the repo:

- turns broad requests into milestones and vertical slices
- proposes sequencing across architecture, implementation, UX, UI, testing, and review
- defines what is in scope now versus later
- keeps work aligned with product goals without leaking repo policy into the role file

## What Must Stay Out Of Role Files

Do not place these in `.agents/*.instruciton.md`:

- repo goals
- source layout
- milestone plan
- stack choices for this project
- feature roadmap
- repo-specific coding constraints

Keep role files behavioral so they can be reused and remain stable.
