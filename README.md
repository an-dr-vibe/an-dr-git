# an-dr-git

Cross-platform Git client focused on a clear repository tree, branches, push/pull, and a diff view built from native `git diff` output.

## Development

The repo now includes the Phase 0 foundations scaffold for Electron, React, Vite, TypeScript, ESLint, Vitest, and Electron Forge packaging.

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
- [docs/product-plan.md](docs/product-plan.md)
- [docs/stakeholder-brief.md](docs/stakeholder-brief.md)
- [AGENTS.md](AGENTS.md)
