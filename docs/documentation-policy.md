# Documentation Policy

## Purpose

This document defines what must be documented, for whom, and when.

The repo has two audiences:

- development-side readers
- user-side readers

Both need current documentation.

## Development-Side Documentation

Development-side docs explain how the product is built and how the team works.

Current development-side docs:

- `AGENTS.md`
- `docs/architecture.md`
- `docs/development-workflow.md`
- `docs/documentation-policy.md`
- `docs/product-plan.md`

These docs should be updated when:

- architecture changes
- workflows change
- quality gates change
- role responsibilities change
- the phased product plan changes

## User-Side Documentation

User-side docs explain what the product does and how to use it.

Current user-side docs:

- `README.md`
- `docs/stakeholder-brief.md`

Future user-side docs should include:

- installation guide
- first-run guide
- repository opening and switching guide
- diff and branch workflow guide
- push and pull guide
- troubleshooting guide
- release notes

These docs should be updated when:

- a user-visible behavior changes
- a setup requirement changes
- a workflow changes
- an error or troubleshooting path changes

## Same-Change-Set Rule

Documentation should change in the same change set as the behavior it describes.

Allowed:

- code plus tests plus docs in one change
- workflow update plus docs update in one change

Not allowed:

- "docs later" as the default plan
- shipping a user-visible change with stale instructions

## Minimum Documentation Expectations

### For A New Internal Rule

Update:

- `AGENTS.md`
- the most relevant workflow or architecture doc

### For A New Technical Capability

Update:

- `docs/architecture.md`
- `README.md` if the capability changes repo usage or setup

### For A New User-Visible Workflow

Update:

- development-side docs if the implementation model changed
- user-side docs that explain the workflow

### For A New Quality Gate Or Automation Entry Point

Update:

- `docs/development-workflow.md`
- `README.md` if developers need the command

## Documentation Quality Rules

1. Keep docs explicit and operational.
2. Prefer instructions that can be executed and checked.
3. Keep developer docs truthful to the repo, not generic.
4. Keep user docs task-oriented, not implementation-heavy.
5. Remove stale assumptions when facts become explicit decisions.

## Verification

Documentation quality is part of the quality gate.

At minimum, the docs gate should verify:

- required docs exist
- required agent instruction files exist
- key docs referenced from `README.md` exist
- changes that affect workflow or behavior update the relevant docs
