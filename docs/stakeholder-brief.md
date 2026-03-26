# Stakeholder Brief

## Summary

`an-dr-git` is planned as a modern cross-platform Git desktop client for Windows and Linux with a high-trust, high-clarity experience centered on:

- repository tree
- branches
- diff inspection
- push
- pull

The product direction is intentionally narrow at first. The goal is not to build every Git feature immediately. The goal is to build a credible, premium-quality Git client foundation that users can trust on real repositories.

## Vision

The product should feel like:

- a serious developer tool
- visually modern and high quality
- fast to scan and comfortable to use every day
- faithful to Git rather than misleadingly simplified
- minimalistic and clear, with stronger area separation and contrast than flat white surfaces with faint borders

The long-term ambition is to become your own viable alternative to tools like SmartGit, starting from the most important workflows and expanding only after the core is solid.

## Why This Direction

This plan deliberately starts with tree, branches, diff, push, and pull because those flows:

- carry a large part of day-to-day Git usage
- expose the product’s trustworthiness early
- force the architecture to solve the hardest base problems first
- create a usable product slice without requiring the full Git surface area

This is the right order if the goal is a durable product rather than a fast demo.

## Product Strategy

### Initial Strategy

Build a narrow MVP that proves four things:

1. the app can represent repository state correctly
2. the diff experience is genuinely useful
3. sync operations are safe and transparent
4. the interface feels meaningfully better than a generic wrapper

### Expansion Strategy

After the MVP is stable, expand into higher-complexity workflows such as:

- history browsing
- search
- merge and rebase flows
- commit authoring
- staging
- stash and tags
- submodules and worktrees

The product should grow only after the core trust model is proven.

## Planned Phases

### Phase 0: Foundations

Desktop shell, system Git detection, repository open flow, IPC, logging, and operation safety.

Status:

- Complete on March 26, 2026.

### Phase 1: Tree And Branches

Repository tree, branch visibility, refresh model, and core repository-state clarity.

Status:

- Complete on March 26, 2026. See `docs/phase-1-plan.md` for the execution backlog that was delivered.

### Phase 2: Diff

Readable diff experience built from native Git output with raw fallback.

Status:

- Planned next. See `docs/phase-2-plan.md` for the execution backlog.

### Phase 3: Push And Pull

Safe sync flows with explicit feedback and error visibility.

### Phase 4: MVP Quality Pass

UI polish, UX refinement, same-window repo tabs, keyboard workflows, large-repo validation, and product hardening.

### Phase 5: Expansion

Advanced Git workflows and broader repository-management features.

## Main Risks

### Product Risks

- the product becomes broad before it becomes trustworthy
- the app looks polished but is weak on dense, real Git workflows
- the interface ends up generic instead of distinctive

### Technical Risks

- Git edge cases are mishandled
- diff rendering is not robust enough
- cross-platform behavior differs more than expected
- large repositories expose performance problems

### UX Risks

- Git complexity is oversimplified and users lose trust
- refresh and operation states are unclear
- error reporting becomes too abstract

## Stakeholder Decisions

Current decisions from the main stakeholder:

- the phased MVP approach and current recommendation are approved
- system Git is the authoritative backend for MVP
- if Git is missing, the app should report clearly that it must be installed
- the target user is similar to SmartGit's user base
- Electron plus TypeScript is the Phase 1 stack
- `pull --ff-only` is the safe initial pull model
- authentication stays delegated to SSH and Git credential helpers
- repository switching should happen in the same window, with tabs as the preferred model
- the visual direction should be minimalistic and clear, with higher contrast and separated areas
- accent color should be configurable
- MVP should ship with light theme only
- dark theme should come later
- post-MVP feature priority should be history/search first, then merge/rebase, then other advanced workflows

## Remaining Questions

These are the important product questions that still remain:

1. Should repository tabs be part of the MVP quality pass, or move immediately after MVP if core stability needs more focus?
2. What minimum diff-rendering quality is acceptable before raw diff fallback becomes the primary view?
3. How should detected submodules, worktrees, and nested repos be surfaced before they are fully supported?
4. Should `pull --ff-only` stay the default long term, or become configurable later?

## What Success Looks Like

The MVP should be considered successful if it can honestly claim:

- repository state is clear and trustworthy
- diff reading is strong enough that users prefer it to raw CLI output
- push and pull feel safe because the app does not hide Git behavior
- the product already feels premium, not provisional

## What Would Make The Plan Fail

The plan will fail if:

- advanced Git features are added before the basics are reliable
- the UI is polished visually but poor for expert workflows
- raw Git truth gets buried under optimistic UI abstractions
- cross-platform reliability is assumed instead of verified

## Current Recommendation

Approved. Keep the first implementation focused on:

- tree and branches
- diff
- push and pull
- interface quality
- a tab-ready repository session model, even if tab polish lands late in MVP

Immediate execution note:

- The repo now has the completed Phase 0 shell plus the completed Phase 1 repository snapshot, tree, branch, and refresh slice.
- The next delivery target is Phase 2 diff visibility without expanding into sync work early.

This is the shortest path to a credible product instead of a shallow feature list.
