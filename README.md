# an-dr-git

Cross-platform Git client focused on a clear repository tree, branches, push/pull, and a diff view built from native `git diff` output.

## Development

The repo now includes the completed Phase 0 foundations shell plus typed IPC contracts, system Git detection, repository open flow, session lifecycle, operation-queue scaffolding, structured Git logging, and Electron Forge packaging on top of Electron, React, Vite, TypeScript, ESLint, and Vitest.

Use Node `20.9+` with `npm`.

Local setup:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run app:start`
- `npm run package:verify`
- `npm run make:verify:win`
- `pwsh ./scripts/quality-gate.ps1`

App shell commands:

- `npm run app:start` builds the app and launches the Electron shell for manual testing
- `npm run app:smoke` builds the app and runs a launch smoke test that exits automatically
- `npm run package:verify` creates a repo-local packaged app under `artifacts/forge/` and smoke-launches the packaged executable
- `npm run make:verify:win` creates a Windows installer under `artifacts/forge/make/` and verifies the installer artifact exists
- `npm run make:verify:deb` creates a Debian installer under `artifacts/forge/make/` and verifies the `.deb` artifact exists

Current Phase 0 behaviors:

- preload exposes typed `getBootstrap`, `getGitStatus`, `openRepository`, and `pickAndOpenRepository` APIs only
- system Git detection reports structured ready, missing, or unusable states to the renderer
- repository open validates the path through the main process and returns structured errors for invalid paths and non-repositories
- successful repository open creates or reactivates a session-owned repository identity with root path, git dir path, and HEAD state
- repository sessions now have explicit lifecycle handling in the main process registry
- Git CLI executions emit structured logs with command context for debugging
- the shell explicitly renders the Phase 0 state matrix required for startup, Git attention, no-repo, open-in-progress, opened, invalid-repository, and unexpected-error states

Phase status:

- Phase 0: complete
- Phase 1: planned in `docs/phase-1-plan.md`

Platform notes:

- Windows installers are built with Electron Forge Squirrel on Windows
- Debian `.deb` installers require a Linux or macOS host with `fakeroot` and `dpkg` available, per Electron Forge's maker requirements
- Repo-local runnable verification artifacts are written under `artifacts/forge/`

Primary docs:

- [PHILOSOPHY.md](PHILOSOPHY.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/development-workflow.md](docs/development-workflow.md)
- [docs/documentation-policy.md](docs/documentation-policy.md)
- [docs/phase-0-plan.md](docs/phase-0-plan.md)
- [docs/phase-1-plan.md](docs/phase-1-plan.md)
- [docs/product-plan.md](docs/product-plan.md)
- [docs/stakeholder-brief.md](docs/stakeholder-brief.md)
- [AGENTS.md](AGENTS.md)
