import { watch, type FSWatcher } from "node:fs";

import type { RepositorySnapshotState } from "../../shared/contracts/app-shell.js";
import { GitExecutableResolver } from "../git/git-executable-resolver.js";
import { RepositoryRegistry } from "./repository-registry.js";
import { buildRepositorySnapshot } from "./repository-snapshot-builder.js";

interface WatchRegistration {
  readonly watchers: FSWatcher[];
  timer: NodeJS.Timeout | null;
  refreshPromise: Promise<RepositorySnapshotState> | null;
}

export class RepositorySnapshotService {
  readonly #gitExecutableResolver: GitExecutableResolver;
  readonly #repositoryRegistry: RepositoryRegistry;
  readonly #watchersBySession = new Map<string, WatchRegistration>();

  constructor(gitExecutableResolver: GitExecutableResolver, repositoryRegistry: RepositoryRegistry) {
    this.#gitExecutableResolver = gitExecutableResolver;
    this.#repositoryRegistry = repositoryRegistry;
  }

  async ensureActiveRepositoryWatchers(): Promise<void> {
    const session = this.#getActiveSession();

    if (!session) {
      return;
    }

    this.#ensureSessionWatchers(session.getIdentity().sessionId);
  }

  async prepareSession(sessionId: string): Promise<void> {
    this.#ensureSessionWatchers(sessionId);
  }

  async getActiveSnapshotState(): Promise<RepositorySnapshotState> {
    const session = this.#getActiveSession();

    if (!session) {
      return this.#createEmptyState();
    }

    this.#ensureSessionWatchers(session.getIdentity().sessionId);
    return session.getSnapshotState();
  }

  async refreshActiveSnapshot(): Promise<RepositorySnapshotState> {
    const session = this.#getActiveSession();

    if (!session) {
      return this.#createEmptyState();
    }

    this.#ensureSessionWatchers(session.getIdentity().sessionId);
    return this.#runRefresh(session.getIdentity().sessionId);
  }

  async waitForWatcherRefresh(sessionId: string): Promise<RepositorySnapshotState | null> {
    const watchRegistration = this.#watchersBySession.get(sessionId);

    if (!watchRegistration?.refreshPromise) {
      return null;
    }

    return watchRegistration.refreshPromise;
  }

  #createEmptyState(): RepositorySnapshotState {
    return {
      activeRepository: null,
      snapshot: null,
      error: null,
      refreshState: "idle",
      isStale: false,
      refreshedAt: null,
    };
  }

  #getActiveSession() {
    const activeRepository = this.#repositoryRegistry.getActive();

    if (!activeRepository) {
      return null;
    }

    return this.#repositoryRegistry.getBySessionId(activeRepository.sessionId);
  }

  #ensureSessionWatchers(sessionId: string): void {
    if (this.#watchersBySession.has(sessionId)) {
      return;
    }

    const session = this.#repositoryRegistry.getBySessionId(sessionId);

    if (!session) {
      return;
    }

    const identity = session.getIdentity();
    const watchers: FSWatcher[] = [];
    const watchRegistration: WatchRegistration = {
      watchers,
      timer: null,
      refreshPromise: null,
    };
    const onWatcherHint = (): void => {
      const currentSession = this.#repositoryRegistry.getBySessionId(sessionId);

      if (!currentSession || currentSession.isClosed()) {
        return;
      }

      currentSession.markSnapshotStale();

      if (watchRegistration.timer) {
        clearTimeout(watchRegistration.timer);
      }

      watchRegistration.timer = setTimeout(() => {
        void this.#runRefresh(sessionId).catch(() => undefined);
      }, 250);
      watchRegistration.timer.unref();
    };
    const trackedWatchTargets = [
      { path: identity.rootPath, recursive: process.platform === "win32" },
      { path: identity.gitDirectoryPath, recursive: false },
      { path: `${identity.gitDirectoryPath}/HEAD`, recursive: false },
      { path: `${identity.gitDirectoryPath}/index`, recursive: false },
      { path: `${identity.gitDirectoryPath}/refs`, recursive: false },
    ];

    for (const target of trackedWatchTargets) {
      const watcher = this.#tryCreateWatcher(target.path, target.recursive, onWatcherHint);

      if (watcher) {
        watchers.push(watcher);
      }
    }

    session.registerTeardown(() => {
      if (watchRegistration.timer) {
        clearTimeout(watchRegistration.timer);
      }

      for (const watcher of watchers) {
        watcher.close();
      }

      this.#watchersBySession.delete(sessionId);
    });
    this.#watchersBySession.set(sessionId, watchRegistration);
  }

  async #runRefresh(sessionId: string): Promise<RepositorySnapshotState> {
    const session = this.#repositoryRegistry.getBySessionId(sessionId);

    if (!session || session.isClosed()) {
      return this.#createEmptyState();
    }

    const watchRegistration = this.#watchersBySession.get(sessionId);

    if (watchRegistration?.refreshPromise) {
      return watchRegistration.refreshPromise;
    }

    session.markSnapshotLoading();

    const refreshPromise = session.runOperation("read", async () => {
      const identity = session.getIdentity();
      const result = await buildRepositorySnapshot(identity, this.#gitExecutableResolver);

      if ("error" in result) {
        return session.applySnapshotError(result.error);
      }

      session.updateIdentity({
        ...identity,
        currentHead: result.snapshot.head.label,
        isDetached: result.snapshot.head.kind === "detached",
        isUnborn: result.snapshot.head.isUnborn,
      });
      return session.applySnapshot(result.snapshot);
    });

    if (watchRegistration) {
      watchRegistration.refreshPromise = refreshPromise.finally(() => {
        watchRegistration.refreshPromise = null;
      });
      return watchRegistration.refreshPromise;
    }

    return refreshPromise;
  }

  #tryCreateWatcher(targetPath: string, recursive: boolean, onChange: () => void): FSWatcher | null {
    try {
      return watch(targetPath, { recursive }, onChange);
    } catch {
      return null;
    }
  }
}
