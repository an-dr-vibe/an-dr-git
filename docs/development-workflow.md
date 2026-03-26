# Development Workflow

## Purpose

This document defines how work should move through the repo.

The goal is a constant feedback loop:

- implement
- verify
- measure
- review
- document

The same principle applies to code, UI, UX, and documentation.

## Core Rules

1. No meaningful change is complete without verification evidence.
2. Verification should be automated first, manual second.
3. Local and CI entry points should use cross-platform PowerShell scripts executed with `pwsh`.
4. User-visible behavior changes must update both developer docs and user docs.
5. Coverage is a gate, not a nice-to-have.

## Development Principles

These principles are the default engineering standard for the repo.

### SOLID

Use SOLID as a design discipline for maintainable modules and boundaries.

In this repo, that means:

- keep services focused on one responsibility
- depend on explicit interfaces and contracts
- design components so they can be extended without fragile rewrites
- avoid leaking renderer, Git, and platform concerns across layers

### Clean Architecture

Protect the main boundaries of the app:

- UI depends on typed contracts, not Git execution details
- application services coordinate behavior
- Git and platform integrations stay behind clear adapters
- shared domain types remain stable and explicit

### DRY

Do not duplicate logic, workflows, or contract definitions without a reason.

Apply DRY carefully:

- remove accidental duplication
- keep useful clarity
- do not create premature abstractions just to avoid two similar lines of code

### Test-Driven Development

TDD is the default for logic-heavy and behavior-critical work.

Expected pattern:

1. define the behavior
2. write or update a failing test when practical
3. implement the smallest change that makes it pass
4. refactor safely under test coverage

If strict TDD is not practical for a change, the verification loop must still be explicit.

### Clean Code

Code should be:

- readable
- intention-revealing
- small in scope
- explicit in error handling
- easy to test and change

Avoid cleverness that reduces maintainability.

### Documentation As Code

Documentation is part of the implementation.

Rules:

- update docs in the same change set as the behavior
- version docs with the code
- keep docs operational and reviewable
- treat stale docs as defects

### Semantic Versioning

Use Semantic Versioning for releases:

- MAJOR for breaking changes
- MINOR for backward-compatible features
- PATCH for backward-compatible fixes

Do not make versioning decisions casually; version numbers must reflect real compatibility impact.

### Conventional Commits

Use Conventional Commits for commit messages where practical.

Preferred format:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `test: ...`
- `build: ...`
- `chore: ...`

This supports clearer history, automation, and release notes.

## Standard Feedback Loops

### Code Loop

Every code change should follow this loop:

1. restate acceptance criteria
2. implement the smallest useful slice
3. add or update unit tests in the same change
4. run the local quality gate
5. inspect failures, regressions, and coverage
6. update relevant documentation

Expected evidence:

- unit test results
- coverage result
- integration or manual evidence for user-facing behavior

### UI Loop

Every UI change should follow this loop:

1. define the screen or component goal
2. define a state matrix
3. implement the UI
4. verify readability, hierarchy, interaction, and edge states
5. document the behavior and any design decisions

Minimum state matrix:

- normal
- loading
- empty
- error
- dense-data or large-data
- unusual Git state relevant to the screen

Expected evidence:

- component or screen-level tests where appropriate
- screenshot or visual verification evidence when the repo has UI tooling
- keyboard-flow verification
- accessibility check for labels, focus, and contrast

### UX Loop

Every workflow change should follow this loop:

1. define the user task
2. define the safe outcome and likely failure outcomes
3. walk the flow against real repository states
4. verify clarity, efficiency, and trustworthiness
5. document the flow and unresolved tradeoffs

Expected evidence:

- scenario checklist
- edge-case walkthrough
- copy and warning-state review
- confirmation that Git truth is not hidden or distorted

### Documentation Loop

Every meaningful change should follow this loop:

1. identify developer-facing docs affected
2. identify user-facing docs affected
3. update docs in the same change set
4. run the docs check

Expected evidence:

- updated docs
- passing docs gate

## Quality Gates

### Baseline Gate

Before a change is considered ready, it should pass:

- docs check
- lint
- typecheck
- unit tests
- coverage gate

### Coverage Gate

Default target:

- statements: 90%
- branches: 90%
- functions: 90%
- lines: 90%

If a threshold cannot be met, the gap must be explicit and temporary. Hidden gaps are not acceptable.

### UI Gate

For UI-heavy work, the change should also pass:

- state-matrix review
- keyboard interaction review
- contrast/readability review
- dense-data review
- error-state review

### UX Gate

For flow-heavy work, the change should also pass:

- task walkthrough
- failure-path walkthrough
- copy review for warnings and recovery guidance
- confirmation that actions do not imply more safety than Git actually provides

## Required Documentation By Change Type

### Code/Architecture Change

Update as needed:

- `docs/architecture.md`
- `docs/development-workflow.md`
- `docs/documentation-policy.md`
- `README.md`

### Product/Scope Change

Update as needed:

- `docs/product-plan.md`
- `docs/stakeholder-brief.md`

### User-Visible Feature Change

Update as needed:

- developer docs listed above
- README
- future user guide or help documentation when those docs exist

## Automation Model

The repo standardizes on these local/CI entry points:

- `pwsh ./scripts/check-docs.ps1`
- `pwsh ./scripts/coverage-gate.ps1`
- `pwsh ./scripts/quality-gate.ps1`

`quality-gate.ps1` is the primary entry point. It should be the default local check and the default CI check.

## Future Tooling Expectations

Once the app scaffold exists, the repo should support these package scripts:

- `lint`
- `typecheck`
- `test:unit`
- `test:integration`
- `test:e2e`

Recommended future additions:

- visual regression checks
- accessibility checks
- screenshot-based state verification for critical screens

## Operating Expectations

### For Developers

- do not treat passing code as sufficient without tests
- do not close UI work without explicit state verification
- do not close UX work without failure-path verification
- do not defer docs to a later cleanup task

### For Reviewers

- check that the loop is closed, not only that code exists
- challenge missing tests, weak coverage, undocumented behavior, and unverified UI states

### For The Product Manager

- plan work in slices that can actually complete the loop
- avoid scope that creates work which cannot be verified inside the same milestone
