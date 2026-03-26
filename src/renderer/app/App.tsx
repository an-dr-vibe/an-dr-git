import { useEffect, useState } from "react";

import type {
  AppShellBootstrap,
  AppShellApi,
  BranchSummary,
  FileChangeKind,
  GitStatus,
  OpenRepositoryResult,
  RepositoryIdentity,
  RepositorySnapshotState,
  TreeNode,
} from "../../shared/contracts/app-shell.js";
import type {
  DiffFile,
  DiffLine,
  RepositoryDiffResult,
} from "../../shared/contracts/repository-diff.js";
import { APP_SHELL_VERSION } from "../../shared/domain/app-shell-layout.js";
import {
  getPhase1StateMatrix,
  resolvePhase1State,
} from "../../shared/domain/phase-1-state-matrix.js";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      bootstrap: AppShellBootstrap;
      gitStatus: GitStatus;
      activeRepository: RepositoryIdentity | null;
      lastOpenResult: OpenRepositoryResult | null;
      snapshotState: RepositorySnapshotState;
    }
  | { kind: "error"; message: string };

interface FlatTreeNode {
  readonly node: TreeNode;
  readonly depth: number;
}

type LoadedDiffResult = Extract<RepositoryDiffResult, { kind: "loaded" }>;

type DiffLoadState =
  | { kind: "idle" }
  | {
      kind: "loading";
      request: {
        readonly sessionId: string;
        readonly filePath: string;
      };
    }
  | {
      kind: "loaded";
      result: LoadedDiffResult;
    }
  | {
      kind: "error";
      error: {
        readonly summary: string;
        readonly detail: string;
        readonly repositoryPath?: string | undefined;
        readonly stderr?: string | undefined;
      };
      requestPath: string | null;
    };

const EMPTY_SNAPSHOT_STATE: RepositorySnapshotState = {
  activeRepository: null,
  snapshot: null,
  error: null,
  refreshState: "idle",
  isStale: false,
  refreshedAt: null,
};

function getAppShell(): AppShellApi {
  if (window.appShell === undefined) {
    throw new Error("Preload bridge is unavailable. The app shell API was not exposed to the renderer.");
  }

  return window.appShell;
}

export function App(): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [repositoryPath, setRepositoryPath] = useState("");
  const [isOpeningRepository, setIsOpeningRepository] = useState(false);
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [selectedBranchRef, setSelectedBranchRef] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<DiffLoadState>({ kind: "idle" });

  useEffect(() => {
    window.__AN_DR_GIT_RENDERER_STATE__ = loadState.kind;
    document.documentElement.dataset.appShellState = loadState.kind;
  }, [loadState.kind]);

  useEffect(() => {
    let cancelled = false;
    const appShell = getAppShell();

    void Promise.all([appShell.getBootstrap(), appShell.getGitStatus() ])
      .then(([bootstrap, gitStatus]) => {
        if (!cancelled) {
          setLoadState({
            kind: "ready",
            bootstrap,
            gitStatus,
            activeRepository: null,
            lastOpenResult: null,
            snapshotState: EMPTY_SNAPSHOT_STATE,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "App shell bootstrap failed.";
          setLoadState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSessionId = loadState.kind === "ready" ? loadState.activeRepository?.sessionId ?? null : null;
  const diffSnapshot = loadState.kind === "ready" ? loadState.snapshotState.snapshot : null;

  useEffect(() => {
    if (loadState.kind !== "ready" || !activeSessionId) {
      return;
    }

    let cancelled = false;

    const refreshSnapshot = async (): Promise<void> => {
      const snapshotState = await getAppShell().refreshRepositorySnapshot();

      if (!cancelled) {
        applySnapshotState(snapshotState);
      }
    };

    void refreshSnapshot().catch((error: unknown) => {
      if (!cancelled) {
        const message = error instanceof Error ? error.message : "Snapshot refresh failed.";
        setLoadState({ kind: "error", message });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, loadState.kind]);

  useEffect(() => {
    if (loadState.kind !== "ready" || !loadState.activeRepository) {
      setDiffState({ kind: "idle" });
      return;
    }

    const requestedNode = resolveSelectedTreeNode(
      flattenTree(loadState.snapshotState.snapshot?.tree ?? []),
      selectedTreePath
    );

    if (!requestedNode || requestedNode.kind !== "file") {
      setDiffState({ kind: "idle" });
      return;
    }

    const request = {
      sessionId: loadState.activeRepository.sessionId,
      filePath: requestedNode.path,
    };
    let cancelled = false;

    setDiffState({ kind: "loading", request });

    void getAppShell()
      .getRepositoryDiff(request)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.kind === "loaded") {
          setDiffState({ kind: "loaded", result });
          return;
        }

        setDiffState({
          kind: "error",
          error: result.error,
          requestPath: result.request?.filePath ?? request.filePath,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDiffState({
            kind: "error",
            error: {
              summary: "Diff loading failed.",
              detail: error instanceof Error ? error.message : "The diff request did not complete.",
            },
            requestPath: request.filePath,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadState.kind, activeSessionId, diffSnapshot, selectedTreePath]);

  useEffect(() => {
    if (loadState.kind !== "ready" || !activeSessionId) {
      return;
    }

    let cancelled = false;
    const pollHandle = window.setInterval(() => {
      void getAppShell()
        .getRepositorySnapshot()
        .then((snapshotState) => {
          if (!cancelled) {
            applySnapshotState(snapshotState);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : "Snapshot polling failed.";
            setLoadState({ kind: "error", message });
          }
        });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(pollHandle);
    };
  }, [activeSessionId, loadState.kind]);

  const applyOpenRepositoryResult = (result: OpenRepositoryResult): void => {
    setLoadState((currentState) => {
      if (currentState.kind !== "ready") {
        return currentState;
      }

      const activeRepository = result.kind === "opened" ? result.repository : currentState.activeRepository;

      return {
        ...currentState,
        activeRepository,
        lastOpenResult: result,
        snapshotState:
          result.kind === "opened"
            ? {
                ...EMPTY_SNAPSHOT_STATE,
                activeRepository: result.repository,
              }
            : currentState.snapshotState,
      };
    });
    setSelectedTreePath(null);
    setSelectedBranchRef(null);
    setDiffState({ kind: "idle" });
  };

  const applySnapshotState = (snapshotState: RepositorySnapshotState): void => {
    setLoadState((currentState) => {
      if (currentState.kind !== "ready") {
        return currentState;
      }

      return {
        ...currentState,
        activeRepository: snapshotState.activeRepository,
        snapshotState,
      };
    });
  };

  const openRepositoryFromPath = async (path: string): Promise<void> => {
    setIsOpeningRepository(true);

    try {
      applyOpenRepositoryResult(await getAppShell().openRepository({ repositoryPath: path }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Repository open failed.";
      setLoadState({ kind: "error", message });
    } finally {
      setIsOpeningRepository(false);
    }
  };

  const pickAndOpenRepository = async (): Promise<void> => {
    setIsOpeningRepository(true);

    try {
      applyOpenRepositoryResult(await getAppShell().pickAndOpenRepository());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Repository selection failed.";
      setLoadState({ kind: "error", message });
    } finally {
      setIsOpeningRepository(false);
    }
  };

  const refreshSnapshot = async (): Promise<void> => {
    if (loadState.kind !== "ready" || !loadState.activeRepository) {
      return;
    }

    try {
      applySnapshotState(await getAppShell().refreshRepositorySnapshot());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Repository refresh failed.";
      setLoadState({ kind: "error", message });
    }
  };

  if (loadState.kind === "loading") {
    return (
      <main className="shell-loading">
        <section className="shell-loading-card" aria-live="polite">
          <h1 className="shell-loading-title">Launching app shell</h1>
          <p className="shell-loading-copy">
            The renderer is waiting for the preload bridge to provide the initial desktop context.
          </p>
        </section>
      </main>
    );
  }

  if (loadState.kind === "error") {
    return (
      <main className="shell-loading">
        <section className="shell-loading-card" aria-live="assertive">
          <h1 className="shell-loading-title">App shell failed to initialize</h1>
          <p className="shell-loading-copy">{loadState.message}</p>
        </section>
      </main>
    );
  }

  const repositoryActionDisabled = loadState.gitStatus.kind !== "ready" || isOpeningRepository;
  const phase1StateId = resolvePhase1State(loadState.snapshotState);
  const phase1State = getPhase1StateMatrix();
  const lastOpenError = loadState.lastOpenResult?.kind === "error" ? loadState.lastOpenResult.error : null;
  const snapshotError = loadState.snapshotState.error;
  const flatTree = flattenTree(loadState.snapshotState.snapshot?.tree ?? []);
  const branchGroups = loadState.snapshotState.snapshot?.branches ?? { local: [], remote: [] };
  const selectedTreeNode = resolveSelectedTreeNode(flatTree, selectedTreePath);
  const allBranches = [...branchGroups.local, ...branchGroups.remote];
  const selectedBranch =
    allBranches.find((branch) => branch.refName === selectedBranchRef) ??
    branchGroups.local.find((branch) => branch.isCurrent) ??
    allBranches[0] ??
    null;
  const repositorySummary = loadState.activeRepository ? (
    <dl className="repository-summary">
      <div>
        <dt>Root</dt>
        <dd>{loadState.activeRepository.rootPath}</dd>
      </div>
      <div>
        <dt>HEAD</dt>
        <dd>
          {loadState.activeRepository.currentHead}
          {loadState.activeRepository.isDetached ? " (detached)" : ""}
          {loadState.activeRepository.isUnborn ? " (unborn)" : ""}
        </dd>
      </div>
      <div>
        <dt>Snapshot</dt>
        <dd>{renderRefreshMeta(loadState.snapshotState)}</dd>
      </div>
    </dl>
  ) : (
    <p className="session-meta">
      No repository is open yet. Use the picker or enter a local path to load the first Phase 1 snapshot.
    </p>
  );

  return (
    <main className="shell-root">
      <div className="shell-frame">
        <header className="shell-topbar">
          <div className="shell-brand">
            <h1 className="shell-title">{loadState.bootstrap.appName}</h1>
            <p className="shell-subtitle">
              Phase 2 is live: Git-backed tree, richer branch state, and a native diff inspector with raw fallback.
            </p>
          </div>
          <div className="shell-badges" aria-label="Application metadata">
            <span className="shell-badge">{APP_SHELL_VERSION}</span>
            <span className="shell-badge">{loadState.bootstrap.platform}</span>
            <span className="shell-badge">
              {loadState.bootstrap.isPackaged ? "Packaged Build" : "Local Build"}
            </span>
            <span className="shell-badge" data-tone={loadState.gitStatus.kind}>
              {loadState.gitStatus.kind === "ready" ? "Git Ready" : "Git Attention"}
            </span>
            <span className="shell-badge" data-tone={phase1StateId === "error" ? "error" : phase1StateId}>
              {phase1StateId}
            </span>
          </div>
        </header>

        <section className="session-strip" aria-label={loadState.bootstrap.sessionContainerLabel}>
          <div className="session-card" tabIndex={0}>
            <div className="session-accent" aria-hidden="true" />
            <div>
              <h2 className="session-title">{loadState.bootstrap.sessionContainerLabel}</h2>
              {repositorySummary}
            </div>
          </div>

          <form
            className="repository-open-form"
            onSubmit={(event) => {
              event.preventDefault();
              void openRepositoryFromPath(repositoryPath);
            }}
          >
            <label className="repository-open-label" htmlFor="repository-path">
              Repository Path
            </label>
            <input
              id="repository-path"
              className="repository-open-input"
              type="text"
              value={repositoryPath}
              onChange={(event) => {
                setRepositoryPath(event.currentTarget.value);
              }}
              placeholder="C:\\work\\repo or /home/me/repo"
              disabled={repositoryActionDisabled}
            />
            <div className="repository-open-actions">
              <button
                className="session-action"
                type="submit"
                disabled={repositoryActionDisabled || repositoryPath.trim().length === 0}
              >
                {isOpeningRepository ? "Opening..." : "Open Path"}
              </button>
              <button
                className="session-action session-action-secondary"
                type="button"
                onClick={() => {
                  void pickAndOpenRepository();
                }}
                disabled={repositoryActionDisabled}
              >
                Browse
              </button>
              <button
                className="session-action session-action-ghost"
                type="button"
                onClick={() => {
                  void refreshSnapshot();
                }}
                disabled={!loadState.activeRepository || loadState.snapshotState.refreshState !== "idle"}
              >
                {loadState.snapshotState.refreshState === "refreshing" ||
                loadState.snapshotState.refreshState === "loading"
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </form>
        </section>

        <section className="status-grid" aria-label="Repository overview status">
          <article className="status-card" data-status={loadState.gitStatus.kind}>
            <span className="status-label">Git Detection</span>
            {loadState.gitStatus.kind === "ready" ? (
              <>
                <h2 className="status-title">System Git is ready</h2>
                <p className="status-copy">
                  {loadState.gitStatus.version} via {loadState.gitStatus.executablePath}
                </p>
              </>
            ) : (
              <>
                <h2 className="status-title">{loadState.gitStatus.error.summary}</h2>
                <p className="status-copy">{loadState.gitStatus.error.detail}</p>
              </>
            )}
          </article>

          <article className="status-card" data-status={phase1StateId}>
            <span className="status-label">Repository Snapshot</span>
            <h2 className="status-title">{describePhase1StateTitle(phase1StateId)}</h2>
            <p className="status-copy">
              {loadState.snapshotState.snapshot
                ? `${loadState.snapshotState.snapshot.counts.trackedFiles} tracked, ${loadState.snapshotState.snapshot.counts.changedFiles} changed, ${loadState.snapshotState.snapshot.counts.untrackedFiles} untracked.`
                : "Open a repository to load tree and branch state from Git CLI output."}
            </p>
          </article>
        </section>

        <section className="state-matrix" aria-label="Phase 1 state matrix">
          <header className="state-matrix-header">
            <div>
              <span className="status-label">State Matrix</span>
              <h2 className="state-matrix-title">Phase 1 repository states stay explicit</h2>
            </div>
            <p className="state-matrix-copy">
              Loading, stale, refresh, and failure cases stay visible so later diff and sync work does not have to
              redesign repository truth.
            </p>
          </header>
          <div className="state-matrix-grid">
            {phase1State.map((state) => (
              <article className="state-matrix-card" data-current={state.id === phase1StateId} key={state.id}>
                <span className="state-matrix-chip">{state.id === phase1StateId ? "Current" : "Ready"}</span>
                <h3 className="state-matrix-card-title">{state.title}</h3>
                <p className="state-matrix-card-copy">{state.description}</p>
              </article>
            ))}
          </div>
        </section>

        {lastOpenError ? <ErrorBanner title={lastOpenError.summary} detail={lastOpenError.detail} error={lastOpenError} /> : null}
        {snapshotError ? <ErrorBanner title={snapshotError.summary} detail={snapshotError.detail} error={snapshotError} /> : null}

        <section className="panel-grid" aria-label="Repository workspace">
          <article className="panel-card" data-panel="repository-tree">
            <header className="panel-header">
              <span className="panel-eyebrow">Workspace</span>
              <h2 className="panel-title">Repository Tree</h2>
              <p className="panel-copy">
                Git-visible files stay in one working tree with familiar explorer rows, indentation, and status overlays.
              </p>
            </header>
            <div className="panel-content">
              {renderTreePanel(loadState.snapshotState, flatTree, selectedTreeNode?.path ?? null, setSelectedTreePath)}
            </div>
            <p className="panel-note">
              {selectedTreeNode
                ? `${selectedTreeNode.path} is selected and ready for the diff inspector.`
                : "Open a repository to inspect the tree model."}
            </p>
          </article>

          <article className="panel-card" data-panel="branch-state">
            <header className="panel-header">
              <span className="panel-eyebrow">Branches</span>
              <h2 className="panel-title">Branch State</h2>
              <p className="panel-copy">
                The current branch is emphasized first, with local and remote refs grouped underneath and tracking
                state kept explicit.
              </p>
            </header>
            <div className="panel-content">
              {renderBranchPanel(loadState.snapshotState, branchGroups, selectedBranch?.refName ?? null, setSelectedBranchRef)}
            </div>
            <p className="panel-note">
              {selectedBranch
                ? `${selectedBranch.name} is selected. Diff and sync flows connect here in later phases.`
                : "Branch visibility appears after the first snapshot is loaded."}
            </p>
          </article>

          <article className="panel-card" data-panel="diff-inspector">
            <header className="panel-header">
              <span className="panel-eyebrow">Phase 2</span>
              <h2 className="panel-title">Diff Inspector</h2>
              <p className="panel-copy">
                Structured hunks stay visible for supported diffs, while the raw Git output remains available for every
                selection.
              </p>
            </header>
            <div className="panel-content panel-content-dark">
              {renderDiffPanel({
                snapshotState: loadState.snapshotState,
                selectedTreeNode,
                selectedBranch,
                diffState,
              })}
            </div>
            <p className="panel-note panel-note-dark">
              {describeDiffPanelNote(selectedTreeNode, selectedBranch, diffState)}
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

function ErrorBanner({
  title,
  detail,
  error,
}: {
  title: string;
  detail: string;
  error: { repositoryPath?: string | undefined; stderr?: string | undefined };
}): JSX.Element {
  return (
    <section className="error-banner" aria-live="assertive">
      <h2 className="error-title">{title}</h2>
      <p className="error-copy">{detail}</p>
      {error.repositoryPath ? <p className="error-meta">Path: {error.repositoryPath}</p> : null}
      {error.stderr ? <pre className="error-raw">{error.stderr}</pre> : null}
    </section>
  );
}

function renderTreePanel(
  snapshotState: RepositorySnapshotState,
  flatTree: readonly FlatTreeNode[],
  selectedPath: string | null,
  setSelectedPath: (path: string) => void
): JSX.Element {
  if (!snapshotState.activeRepository) {
    return <PanelEmpty message="No repository session is active." />;
  }

  if (snapshotState.refreshState === "loading" && !snapshotState.snapshot) {
    return <PanelLoading message="Building the first Git-backed tree snapshot." />;
  }

  if (!snapshotState.snapshot || flatTree.length === 0) {
    return <PanelEmpty message="The repository tree is empty for the current snapshot." />;
  }

  return (
    <div className="tree-list" role="tree" aria-label="Repository tree">
      {flatTree.map((entry) => (
        <button
          className="tree-row"
          data-selected={entry.node.path === selectedPath}
          data-change={entry.node.change}
          key={entry.node.path}
          style={{ paddingLeft: `${16 + entry.depth * 16}px` }}
          type="button"
          onClick={() => {
            setSelectedPath(entry.node.path);
          }}
        >
          <span className="tree-row-rail" aria-hidden="true" />
          <span className="tree-row-indent" aria-hidden="true">
            {renderTreeIndent(entry.depth)}
          </span>
          <span className="tree-row-icon" aria-hidden="true">
            {entry.node.kind === "directory" ? "▸" : fileIcon(entry.node.name)}
          </span>
          <span className="tree-row-main">
            <span className="tree-row-name">{entry.node.name}</span>
            <span className="tree-row-path">{entry.node.path}</span>
          </span>
          <span className="tree-row-change">{changeBadge(entry.node.change)}</span>
        </button>
      ))}
    </div>
  );
}

function renderBranchPanel(
  snapshotState: RepositorySnapshotState,
  branchGroups: { local: BranchSummary[]; remote: BranchSummary[] },
  selectedRefName: string | null,
  setSelectedRefName: (refName: string) => void
): JSX.Element {
  if (!snapshotState.activeRepository) {
    return <PanelEmpty message="No repository session is active." />;
  }

  if (snapshotState.refreshState === "loading" && !snapshotState.snapshot) {
    return <PanelLoading message="Reading local and remote refs from Git." />;
  }

  if (branchGroups.local.length === 0 && branchGroups.remote.length === 0) {
    return <PanelEmpty message="No branches were returned for the current snapshot." />;
  }

  const currentBranch = branchGroups.local.find((branch) => branch.isCurrent) ?? null;

  return (
    <div className="branch-groups">
      {currentBranch ? (
        <section className="branch-current-card">
          <span className="branch-current-eyebrow">Current Branch</span>
          <div className="branch-current-heading">
            <strong>{currentBranch.name}</strong>
            <span>{formatBranchSelection(currentBranch)}</span>
          </div>
          <div className="branch-current-badges">
            <span className="branch-state-badge" data-tone="current">
              current
            </span>
            <span className="branch-state-badge">{currentBranch.upstreamName ?? "no upstream"}</span>
            {currentBranch.aheadCount > 0 ? (
              <span className="branch-state-badge">ahead {currentBranch.aheadCount}</span>
            ) : null}
            {currentBranch.behindCount > 0 ? (
              <span className="branch-state-badge">behind {currentBranch.behindCount}</span>
            ) : null}
          </div>
        </section>
      ) : null}
      <BranchGroup
        title="Local"
        branches={branchGroups.local}
        selectedRefName={selectedRefName}
        onSelect={setSelectedRefName}
      />
      <BranchGroup
        title="Remote"
        branches={branchGroups.remote}
        selectedRefName={selectedRefName}
        onSelect={setSelectedRefName}
      />
    </div>
  );
}

function BranchGroup({
  title,
  branches,
  selectedRefName,
  onSelect,
}: {
  title: string;
  branches: readonly BranchSummary[];
  selectedRefName: string | null;
  onSelect: (refName: string) => void;
}): JSX.Element {
  if (branches.length === 0) {
    return (
      <section className="branch-group">
        <header className="branch-group-header">
          <span className="branch-group-title">{title}</span>
        </header>
        <PanelEmpty message={`No ${title.toLowerCase()} branches for the current repository state.`} />
      </section>
    );
  }

  return (
    <section className="branch-group">
      <header className="branch-group-header">
        <span className="branch-group-title">{title}</span>
      </header>
      <div className="branch-list">
        {branches.map((branch) => (
          <button
            className="branch-row"
            data-selected={branch.refName === selectedRefName}
            data-current={branch.isCurrent}
            key={branch.refName}
            type="button"
            onClick={() => {
              onSelect(branch.refName);
            }}
        >
          <span className="branch-row-rail" aria-hidden="true" />
          <span className="branch-row-main">
            <span className="branch-row-name">
              <span className="branch-row-icon" aria-hidden="true">
                {branch.kind === "local" ? "⑂" : "◌"}
              </span>
              {branch.name}
            </span>
            <span className="branch-row-meta">{formatBranchSelection(branch)}</span>
          </span>
          <span className="branch-row-badges">
            {branch.isCurrent ? (
              <span className="branch-state-badge" data-tone="current">
                current
              </span>
            ) : null}
            {branch.kind === "local" && branch.upstreamName ? (
              <span className="branch-state-badge">{branch.upstreamName}</span>
            ) : null}
            {branch.aheadCount > 0 ? <span className="branch-state-badge">+{branch.aheadCount}</span> : null}
            {branch.behindCount > 0 ? <span className="branch-state-badge">-{branch.behindCount}</span> : null}
          </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PanelLoading({ message }: { message: string }): JSX.Element {
  return (
    <div className="panel-empty">
      <strong>Loading</strong>
      <span>{message}</span>
    </div>
  );
}

function PanelEmpty({ message }: { message: string }): JSX.Element {
  return (
    <div className="panel-empty">
      <strong>Not Ready</strong>
      <span>{message}</span>
    </div>
  );
}

function renderTreeIndent(depth: number): string {
  return depth > 0 ? "│".repeat(depth) : "";
}

function fileIcon(name: string): string {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) {
    return "{}";
  }

  if (name.endsWith(".md")) {
    return "≣";
  }

  if (name.endsWith(".json") || name.endsWith(".yml") || name.endsWith(".yaml")) {
    return "⋯";
  }

  return "•";
}

function renderDiffPanel({
  snapshotState,
  selectedTreeNode,
  selectedBranch,
  diffState,
}: {
  snapshotState: RepositorySnapshotState;
  selectedTreeNode: TreeNode | null;
  selectedBranch: BranchSummary | null;
  diffState: DiffLoadState;
}): JSX.Element {
  if (!snapshotState.activeRepository) {
    return <PanelEmpty message="Open a repository to inspect a diff." />;
  }

  if (!selectedTreeNode) {
    return <PanelEmpty message="Select a file from the repository tree to request a diff." />;
  }

  if (selectedTreeNode.kind === "directory") {
    return <PanelEmpty message="Directory selections stay in the tree panel. Choose a file to inspect its diff." />;
  }

  if (diffState.kind === "loading") {
    return (
      <div className="diff-panel">
        <div className="diff-file-header">
          <div>
            <span className="diff-file-kicker">Loading Diff</span>
            <strong>{diffState.request.filePath}</strong>
          </div>
          <span className="branch-state-badge">{selectedBranch?.name ?? "working tree"}</span>
        </div>
        <div className="diff-panel-body">
          <PanelLoading message="Git is generating the selected file diff." />
        </div>
      </div>
    );
  }

  if (diffState.kind === "error") {
    return (
      <div className="diff-panel">
        <div className="diff-file-header">
          <div>
            <span className="diff-file-kicker">Diff Error</span>
            <strong>{diffState.requestPath ?? selectedTreeNode.path}</strong>
          </div>
          <span className="branch-state-badge" data-tone="danger">
            error
          </span>
        </div>
        <div className="diff-panel-body">
          <ErrorBanner title={diffState.error.summary} detail={diffState.error.detail} error={diffState.error} />
        </div>
      </div>
    );
  }

  if (diffState.kind !== "loaded") {
    return (
      <div className="diff-panel">
        <div className="diff-file-header">
          <div>
            <span className="diff-file-kicker">Ready</span>
            <strong>{selectedTreeNode.path}</strong>
          </div>
          <span className="branch-state-badge">{selectedBranch?.name ?? "working tree"}</span>
        </div>
        <div className="diff-panel-body">
          <PanelEmpty message="The diff inspector is waiting for a valid file selection." />
        </div>
      </div>
    );
  }

  const { document } = diffState.result;
  const primaryFile = document.files[0] ?? null;

  return (
    <div className="diff-panel">
      <div className="diff-file-header">
        <div>
          <span className="diff-file-kicker">Selected File</span>
          <strong>{primaryFile?.displayPath ?? selectedTreeNode.path}</strong>
          <span className="diff-file-meta">
            {primaryFile ? describeDiffFile(primaryFile) : describeEmptyDiffState(selectedTreeNode.change)}
          </span>
        </div>
        <div className="diff-file-badges">
          <span className="branch-state-badge">{changeBadge(selectedTreeNode.change)}</span>
          <span className="branch-state-badge">{document.parseState}</span>
        </div>
      </div>
      <div className="diff-panel-body">
        {document.parseState === "empty" ? (
          <PanelEmpty message={describeEmptyDiffState(selectedTreeNode.change)} />
        ) : null}
        {document.parseState !== "empty" && primaryFile ? (
          <div className="diff-file-section">
            <div className="diff-file-summary">
              <div className="diff-file-summary-paths">
                <span>{primaryFile.oldPath}</span>
                <span>{primaryFile.newPath}</span>
              </div>
              <div className="diff-file-summary-markers">
                {primaryFile.markers.map((marker) => (
                  <span className="branch-state-badge" key={marker}>
                    {marker}
                  </span>
                ))}
              </div>
            </div>
            {primaryFile.hunks.length > 0 ? (
              <div className="diff-hunk-list">
                {primaryFile.hunks.map((hunk) => (
                  <section className="diff-hunk" key={`${primaryFile.displayPath}-${hunk.header}`}>
                    <header className="diff-hunk-header">{hunk.header}</header>
                    <div className="diff-line-list">
                      {hunk.lines.map((line, index) => (
                        <div className="diff-line" data-kind={line.kind} key={`${hunk.header}-${index}-${line.text}`}>
                          <span className="diff-line-number">{line.oldLineNumber ?? ""}</span>
                          <span className="diff-line-number">{line.newLineNumber ?? ""}</span>
                          <span className="diff-line-code">{renderDiffLinePrefix(line)}{line.text}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <PanelEmpty message="Git returned file-level metadata without text hunks for this selection." />
            )}
          </div>
        ) : null}
      </div>
      <details className="diff-fallback" open={document.parseState === "partial" || document.parseState === "raw"}>
        <summary>
          Raw Git Output
          {document.warnings.length > 0 ? ` (${document.warnings.length} parser warning${document.warnings.length === 1 ? "" : "s"})` : ""}
        </summary>
        {document.warnings.length > 0 ? (
          <div className="diff-warning-list">
            {document.warnings.map((warning) => (
              <span className="diff-warning" key={warning}>
                {warning}
              </span>
            ))}
          </div>
        ) : null}
        <pre className="diff-raw-output">{document.rawText || "(Git returned no text output for this selection.)"}</pre>
      </details>
    </div>
  );
}

function describeDiffPanelNote(
  selectedTreeNode: TreeNode | null,
  selectedBranch: BranchSummary | null,
  diffState: DiffLoadState
): string {
  if (!selectedTreeNode) {
    return "Choose a file to inspect the native git diff output for the current working tree.";
  }

  if (selectedTreeNode.kind === "directory") {
    return `${selectedTreeNode.path} is a directory. Select a file to inspect its diff.`;
  }

  if (diffState.kind === "loading") {
    return `Loading the diff for ${selectedTreeNode.path}${selectedBranch ? ` on ${selectedBranch.name}` : ""}.`;
  }

  if (diffState.kind === "error") {
    return diffState.error.summary;
  }

  if (diffState.kind === "loaded") {
    return `Diff requested from Git for ${selectedTreeNode.path}${selectedBranch ? ` while ${selectedBranch.name} stays selected.` : "."}`;
  }

  return `${selectedTreeNode.path} is selected and ready for Git-backed diff inspection.`;
}

function describeDiffFile(file: DiffFile): string {
  if (file.markers.length === 0) {
    return file.changeType;
  }

  return `${file.changeType} • ${file.markers.join(", ")}`;
}

function describeEmptyDiffState(change: FileChangeKind): string {
  if (change === "untracked") {
    return "Git does not emit a working tree diff for an untracked file until it is added or staged.";
  }

  if (change === "ignored") {
    return "Ignored files stay visible in the tree, but they do not produce a repository diff.";
  }

  return "Git returned no text diff for the selected file.";
}

function renderDiffLinePrefix(line: DiffLine): string {
  switch (line.kind) {
    case "addition":
      return "+";
    case "deletion":
      return "-";
    case "context":
      return " ";
    case "meta":
      return "";
  }
}

function flattenTree(nodes: readonly TreeNode[], depth = 0): FlatTreeNode[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

function resolveSelectedTreeNode(
  flatTree: readonly FlatTreeNode[],
  selectedPath: string | null
): TreeNode | null {
  return (
    flatTree.find((entry) => entry.node.path === selectedPath)?.node ??
    flatTree.find((entry) => entry.node.kind === "file")?.node ??
    flatTree[0]?.node ??
    null
  );
}

function changeBadge(change: FileChangeKind): string {
  switch (change) {
    case "clean":
      return "Clean";
    case "added":
      return "Added";
    case "modified":
      return "Modified";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
    case "untracked":
      return "Untracked";
    case "ignored":
      return "Ignored";
  }
}

function formatBranchSelection(branch: BranchSummary): string {
  if (branch.kind === "remote") {
    return branch.remoteName ? `${branch.remoteName} remote-tracking branch` : "Remote-tracking branch";
  }

  if (branch.trackingStatus === "gone") {
    return branch.upstreamName ? `${branch.upstreamName} is gone` : "Upstream is gone";
  }

  if (branch.trackingStatus === "missing") {
    return "No upstream configured";
  }

  const trackingCounts = [];

  if (branch.aheadCount > 0) {
    trackingCounts.push(`ahead ${branch.aheadCount}`);
  }

  if (branch.behindCount > 0) {
    trackingCounts.push(`behind ${branch.behindCount}`);
  }

  return branch.upstreamName
    ? `${branch.upstreamName}${trackingCounts.length > 0 ? `, ${trackingCounts.join(", ")}` : ""}`
    : "Tracking branch";
}

function renderRefreshMeta(snapshotState: RepositorySnapshotState): string {
  if (snapshotState.refreshState === "loading") {
    return "initial snapshot loading";
  }

  if (snapshotState.refreshState === "refreshing") {
    return "refresh in progress";
  }

  if (!snapshotState.refreshedAt) {
    return "not loaded yet";
  }

  return snapshotState.isStale ? "watcher hint pending" : `updated ${new Date(snapshotState.refreshedAt).toLocaleTimeString()}`;
}

function describePhase1StateTitle(state: ReturnType<typeof resolvePhase1State>): string {
  switch (state) {
    case "empty":
      return "No repository snapshot";
    case "loading":
      return "Initial snapshot loading";
    case "ready":
      return "Repository snapshot ready";
    case "refreshing":
      return "Refresh in progress";
    case "stale":
      return "Watcher hint pending";
    case "error":
      return "Snapshot error";
  }
}
