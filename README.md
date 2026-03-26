# an-dr-git

Cross-platform Git client focused on a clear repository tree, branches, push/pull, and a diff view built from native `git diff` output.

## Development

The repo now includes the completed Phase 0, Phase 1, and Phase 2 slices: typed IPC contracts, system Git detection, repository open flow, session lifecycle, Git-backed repository snapshot reads, denser tree and branch rendering, native diff reads with structured parsing and raw fallback, structured Git logging, and Electron Forge packaging on top of Electron, React, Vite, TypeScript, ESLint, and Vitest.

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

Default repo policy:

- `pwsh ./scripts/quality-gate.ps1` is expected to build and verify a repo-local artifact by default
- `npm run package:verify` is the standard packaged-artifact command

App shell commands:

- `npm run app:start` builds the app and launches the Electron shell for manual testing
- `npm run app:smoke` builds the app and runs a renderer-ready smoke test that exits automatically only after the shell becomes visible
- `npm run package:verify` creates a repo-local packaged app under `artifacts/forge/` and smoke-launches the packaged executable with the same renderer-ready verification
- `npm run make:verify:win` creates a Windows installer under `artifacts/forge/make/` and verifies the installer artifact exists
- `npm run make:verify:deb` creates a Debian installer under `artifacts/forge/make/` and verifies the `.deb` artifact exists

Current implemented behaviors:

- preload exposes typed `getBootstrap`, `getGitStatus`, `openRepository`, and `pickAndOpenRepository` APIs only
- system Git detection reports structured ready, missing, or unusable states to the renderer
- repository open validates the path through the main process and returns structured errors for invalid paths and non-repositories
- successful repository open creates or reactivates a session-owned repository identity with root path, git dir path, and HEAD state
- repository sessions now have explicit lifecycle handling in the main process registry
- repository snapshots are built in the main process from native Git commands and validated before the renderer consumes them
- the tree panel renders tracked, changed, untracked, deleted, and ignored paths from a virtual Git-backed tree
- the branch panel renders local and remote refs with current-branch, upstream, and ahead/behind context
- snapshot refresh can be requested manually and is also fed by debounced watcher hints
- the diff panel now requests file diffs through typed IPC and renders structured hunks with line numbers, metadata markers, and inline raw fallback
- untracked and ignored file selections stay explicit instead of pretending Git produced a patch
- the tree now reads like a working-tree explorer and the branch area emphasizes current branch state before local and remote groups
- Git CLI executions emit structured logs with command context for debugging
- the shell explicitly renders the Phase 1 state matrix for empty, loading, ready, refreshing, stale, and error repository states
- Electron renderer builds now use relative asset paths so `npm run app:start` and packaged `loadFile(...)` builds render correctly

Phase status:

- Phase 0: complete on March 26, 2026
- Phase 1: complete on March 26, 2026
- Phase 2: complete on March 26, 2026
- Phase 3: planned in `docs/phase-3-plan.md`

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
- [docs/phase-2-plan.md](docs/phase-2-plan.md)
- [docs/phase-3-plan.md](docs/phase-3-plan.md)
- [docs/product-plan.md](docs/product-plan.md)
- [docs/stakeholder-brief.md](docs/stakeholder-brief.md)
- [AGENTS.md](AGENTS.md)
