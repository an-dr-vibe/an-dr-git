import { useEffect, useState } from "react";

import type {
  AppShellBootstrap,
  BranchSummary,
  FileChangeKind,
  GitStatus,
  OpenRepositoryResult,
  RepositoryIdentity,
  RepositorySnapshotState,
  TreeNode,
} from "../../shared/contracts/app-shell.js";
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

const EMPTY_SNAPSHOT_STATE: RepositorySnapshotState = {
  activeRepository: null,
  snapshot: null,
  error: null,
  refreshState: "idle",
  isStale: false,
  refreshedAt: null,
};

export function App(): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [repositoryPath, setRepositoryPath] = useState("");
  const [isOpeningRepository, setIsOpeningRepository] = useState(false);
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [selectedBranchRef, setSelectedBranchRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([window.appShell.getBootstrap(), window.appShell.getGitStatus() ])
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

  useEffect(() => {
    if (loadState.kind !== "ready" || !activeSessionId) {
      return;
    }

    let cancelled = false;

    const refreshSnapshot = async (): Promise<void> => {
      const snapshotState = await window.appShell.refreshRepositorySnapshot();

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
    if (loadState.kind !== "ready" || !activeSessionId) {
      return;
    }

    let cancelled = false;
    const pollHandle = window.setInterval(() => {
      void window.appShell
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
      applyOpenRepositoryResult(await window.appShell.openRepository({ repositoryPath: path }));
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
      applyOpenRepositoryResult(await window.appShell.pickAndOpenRepository());
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
      applySnapshotState(await window.appShell.refreshRepositorySnapshot());
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
  const selectedTreeNode =
    flatTree.find((entry) => entry.node.path === selectedTreePath)?.node ?? flatTree[0]?.node ?? null;
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
            <p className="shell-subtitle">Phase 1 is live: Git-backed tree, branches, and debounced refresh flow.</p>
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
                Git-visible files are merged into one virtual tree so tracked, changed, untracked, and ignored paths
                stay in one place.
              </p>
            </header>
            <div className="panel-content">
              {renderTreePanel(loadState.snapshotState, flatTree, selectedTreeNode?.path ?? null, setSelectedTreePath)}
            </div>
            <p className="panel-note">
              {selectedTreeNode
                ? `${selectedTreeNode.path} is selected and ready for the Phase 2 diff viewer.`
                : "Open a repository to inspect the tree model."}
            </p>
          </article>

          <article className="panel-card" data-panel="branch-state">
            <header className="panel-header">
              <span className="panel-eyebrow">Branches</span>
              <h2 className="panel-title">Branch State</h2>
              <p className="panel-copy">
                Local and remote refs stay separated, with current-branch, upstream, ahead/behind, and gone-upstream
                state preserved.
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
              <h2 className="panel-title">Diff Inspector Next</h2>
              <p className="panel-copy">
                Phase 2 will turn the selected file and branch context into a structured diff reader with raw fallback.
              </p>
            </header>
            <div className="panel-content panel-content-dark">
              <div className="phase-next-card">
                <strong>Selected File</strong>
                <span>{selectedTreeNode?.path ?? "No file selected yet."}</span>
              </div>
              <div className="phase-next-card">
                <strong>Selected Branch</strong>
                <span>{selectedBranch ? formatBranchSelection(selectedBranch) : "No branch selected yet."}</span>
              </div>
              <div className="phase-next-card">
                <strong>Phase 2 Focus</strong>
                <span>Unified diff parsing, raw fallback, binary handling, and readable hunk presentation.</span>
              </div>
            </div>
            <p className="panel-note panel-note-dark">
              Diff rendering stays intentionally deferred until the repository state layer is trustworthy.
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
          <span className="tree-row-marker">{entry.node.kind === "directory" ? "Dir" : changeBadge(entry.node.change)}</span>
          <span className="tree-row-name">{entry.node.name}</span>
          <span className="tree-row-path">{entry.node.path}</span>
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

  return (
    <div className="branch-groups">
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
            <span className="branch-row-name">{branch.name}</span>
            <span className="branch-row-meta">{formatBranchSelection(branch)}</span>
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

function flattenTree(nodes: readonly TreeNode[], depth = 0): FlatTreeNode[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
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
