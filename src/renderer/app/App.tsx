import { useEffect, useState } from "react";

import type {
  AppShellBootstrap,
  GitStatus,
  OpenRepositoryResult,
  RepositoryIdentity,
} from "../../shared/contracts/app-shell.js";
import { getAppShellPanels } from "../../shared/domain/app-shell-layout.js";
import {
  getPhase0StateMatrix,
  resolvePhase0State,
} from "../../shared/domain/phase-0-state-matrix.js";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      bootstrap: AppShellBootstrap;
      gitStatus: GitStatus;
      activeRepository: RepositoryIdentity | null;
      lastOpenResult: OpenRepositoryResult | null;
    }
  | { kind: "error"; message: string };

const placeholderWidths = ["short", "long", "medium", "long"] as const;

export function App(): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [repositoryPath, setRepositoryPath] = useState("");
  const [isOpeningRepository, setIsOpeningRepository] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([window.appShell.getBootstrap(), window.appShell.getGitStatus()])
      .then(([bootstrap, gitStatus]) => {
        if (!cancelled) {
          setLoadState({
            kind: "ready",
            bootstrap,
            gitStatus,
            activeRepository: null,
            lastOpenResult: null,
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
  const lastError = loadState.lastOpenResult?.kind === "error" ? loadState.lastOpenResult.error : null;
  const currentPhase0State = resolvePhase0State({
    loadStateKind: loadState.kind,
    gitStatus: loadState.kind === "ready" ? loadState.gitStatus : undefined,
    activeRepository: loadState.kind === "ready" ? loadState.activeRepository !== null : false,
    isOpeningRepository,
    lastOpenResult: loadState.kind === "ready" ? loadState.lastOpenResult : null,
  });

  const applyOpenRepositoryResult = (result: OpenRepositoryResult): void => {
    setLoadState((currentState) => {
      if (currentState.kind !== "ready") {
        return currentState;
      }

      return {
        ...currentState,
        activeRepository: result.kind === "opened" ? result.repository : currentState.activeRepository,
        lastOpenResult: result,
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
        <dt>Git Dir</dt>
        <dd>{loadState.activeRepository.gitDirectoryPath}</dd>
      </div>
      <div>
        <dt>Session</dt>
        <dd>{loadState.activeRepository.sessionId}</dd>
      </div>
    </dl>
  ) : (
    <p className="session-meta">
      No repository is open yet. Use the picker or enter a local path to validate the Phase 0 open flow.
    </p>
  );

  return (
    <main className="shell-root">
      <div className="shell-frame">
        <header className="shell-topbar">
          <div className="shell-brand">
            <h1 className="shell-title">{loadState.bootstrap.appName}</h1>
            <p className="shell-subtitle">Typed IPC, Git detection, and repository open flow are now live.</p>
          </div>
          <div className="shell-badges" aria-label="Application metadata">
            <span className="shell-badge">{loadState.bootstrap.shellVersion}</span>
            <span className="shell-badge">{loadState.bootstrap.platform}</span>
            <span className="shell-badge">
              {loadState.bootstrap.isPackaged ? "Packaged Build" : "Local Build"}
            </span>
            <span className="shell-badge" data-tone={loadState.gitStatus.kind}>
              {loadState.gitStatus.kind === "ready" ? "Git Ready" : "Git Attention"}
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
            </div>
          </form>
        </section>

        <section className="status-grid" aria-label="Foundation state">
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

          <article className="status-card" data-status={loadState.activeRepository ? "opened" : "idle"}>
            <span className="status-label">Repository State</span>
            <h2 className="status-title">
              {loadState.activeRepository ? "Repository session active" : "No repository selected"}
            </h2>
            <p className="status-copy">
              {loadState.activeRepository
                ? `HEAD ${loadState.activeRepository.currentHead} is attached to session ${loadState.activeRepository.sessionId}.`
                : "Open a repository to create the first session-owned entity in the main process."}
            </p>
          </article>
        </section>

        <section className="state-matrix" aria-label="Phase 0 state matrix">
          <header className="state-matrix-header">
            <div>
              <span className="status-label">State Matrix</span>
              <h2 className="state-matrix-title">Phase 0 coverage is explicit</h2>
            </div>
            <p className="state-matrix-copy">
              The shell keeps every required foundation state visible so later feature slices do not
              have to redesign the frame.
            </p>
          </header>
          <div className="state-matrix-grid">
            {getPhase0StateMatrix().map((state) => (
              <article
                className="state-matrix-card"
                data-current={state.id === currentPhase0State}
                key={state.id}
              >
                <span className="state-matrix-chip">{state.id === currentPhase0State ? "Current" : "Ready"}</span>
                <h3 className="state-matrix-card-title">{state.title}</h3>
                <p className="state-matrix-card-copy">{state.description}</p>
              </article>
            ))}
          </div>
        </section>

        {lastError ? (
          <section className="error-banner" aria-live="assertive">
            <h2 className="error-title">{lastError.summary}</h2>
            <p className="error-copy">{lastError.detail}</p>
            {lastError.repositoryPath ? (
              <p className="error-meta">Path: {lastError.repositoryPath}</p>
            ) : null}
            {lastError.stderr ? <pre className="error-raw">{lastError.stderr}</pre> : null}
          </section>
        ) : null}

        <section className="panel-grid" aria-label="App shell layout">
          {getAppShellPanels().map((panel) => (
            <article className="panel-card" key={panel.id} data-panel={panel.id} tabIndex={0}>
              <header className="panel-header">
                <span className="panel-eyebrow">{panel.eyebrow}</span>
                <h2 className="panel-title">{panel.title}</h2>
                <p className="panel-copy">{panel.description}</p>
              </header>
              <div className="panel-placeholder" aria-hidden="true">
                {loadState.activeRepository ? (
                  <div className="panel-live-copy">
                    {panel.id === "repository-tree" ? (
                      <>
                        <strong>{loadState.activeRepository.rootPath}</strong>
                        <span>Repository root is resolved through Git CLI validation.</span>
                      </>
                    ) : null}
                    {panel.id === "branch-state" ? (
                      <>
                        <strong>{loadState.activeRepository.currentHead}</strong>
                        <span>
                          {loadState.activeRepository.isDetached
                            ? "Detached HEAD detected."
                            : loadState.activeRepository.isUnborn
                              ? "Unborn branch detected."
                              : "Named branch detected."}
                        </span>
                      </>
                    ) : null}
                    {panel.id === "diff-inspector" ? (
                      <>
                        <strong>Raw Git fallback preserved</strong>
                        <span>Open failures already keep stderr available for debugging.</span>
                      </>
                    ) : null}
                  </div>
                ) : (
                  placeholderWidths.map((width, index) => (
                    <span className="placeholder-line" data-width={width} key={`${panel.id}-${index}`} />
                  ))
                )}
              </div>
              <p className="panel-note">
                {loadState.activeRepository
                  ? "Foundations are live. Structured tree, branches, and diff rendering land in later slices."
                  : "The panel skeleton stays visible while the first repository flow is exercised."}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
