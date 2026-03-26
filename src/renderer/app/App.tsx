import { useEffect, useState } from "react";

import type { AppShellBootstrap } from "../../shared/contracts/app-shell.js";
import { getAppShellPanels } from "../../shared/domain/app-shell-layout.js";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; bootstrap: AppShellBootstrap }
  | { kind: "error"; message: string };

const placeholderWidths = ["short", "long", "medium", "long"] as const;

export function App(): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    void window.appShell
      .getBootstrap()
      .then((bootstrap) => {
        if (!cancelled) {
          setLoadState({ kind: "ready", bootstrap });
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

  const { bootstrap } = loadState;

  return (
    <main className="shell-root">
      <div className="shell-frame">
        <header className="shell-topbar">
          <div className="shell-brand">
            <h1 className="shell-title">{bootstrap.appName}</h1>
            <p className="shell-subtitle">Desktop shell in place, repository workflows land next.</p>
          </div>
          <div className="shell-badges" aria-label="Application metadata">
            <span className="shell-badge">{bootstrap.shellVersion}</span>
            <span className="shell-badge">{bootstrap.platform}</span>
            <span className="shell-badge">
              {bootstrap.isPackaged ? "Packaged Build" : "Local Build"}
            </span>
          </div>
        </header>

        <section className="session-strip" aria-label={bootstrap.sessionContainerLabel}>
          <div className="session-card" tabIndex={0}>
            <div className="session-accent" aria-hidden="true" />
            <div>
              <h2 className="session-title">{bootstrap.sessionContainerLabel}</h2>
              <p className="session-meta">
                Same-window repository tabs are accounted for structurally, even before tab UI exists.
              </p>
            </div>
          </div>
          <button className="session-action" type="button">
            Open Repository
          </button>
        </section>

        <section className="panel-grid" aria-label="App shell layout">
          {getAppShellPanels().map((panel) => (
            <article className="panel-card" key={panel.id} data-panel={panel.id} tabIndex={0}>
              <header className="panel-header">
                <span className="panel-eyebrow">{panel.eyebrow}</span>
                <h2 className="panel-title">{panel.title}</h2>
                <p className="panel-copy">{panel.description}</p>
              </header>
              <div className="panel-placeholder" aria-hidden="true">
                {placeholderWidths.map((width, index) => (
                  <span className="placeholder-line" data-width={width} key={`${panel.id}-${index}`} />
                ))}
              </div>
              <p className="panel-note">Placeholder only for slice 0.2. Live repository state is next.</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
