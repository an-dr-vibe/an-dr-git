import type {
  AppShellError,
  RepositoryIdentity,
  RepositorySnapshot,
  RepositorySnapshotRefreshState,
  RepositorySnapshotState,
} from "../../shared/contracts/app-shell.js";
import {
  RepositoryOperationQueue,
  type RepositoryOperationKind,
} from "./repository-operation-queue.js";

export class RepositorySession {
  readonly #operationQueue = new RepositoryOperationQueue();
  #identity: RepositoryIdentity;
  #isClosed = false;
  #snapshot: RepositorySnapshot | null = null;
  #snapshotError: AppShellError | null = null;
  #snapshotRefreshState: RepositorySnapshotRefreshState = "idle";
  #isSnapshotStale = false;
  #snapshotRefreshedAt: string | null = null;
  readonly #teardowns = new Set<() => void>();

  constructor(identity: RepositoryIdentity) {
    this.#identity = identity;
  }

  getIdentity(): RepositoryIdentity {
    return { ...this.#identity };
  }

  updateIdentity(identity: RepositoryIdentity): RepositoryIdentity {
    this.#assertOpen();
    this.#identity = identity;

    return this.getIdentity();
  }

  async runOperation<T>(kind: RepositoryOperationKind, work: () => Promise<T>): Promise<T> {
    this.#assertOpen();
    return this.#operationQueue.run(kind, work);
  }

  close(): RepositoryIdentity {
    this.#assertOpen();
    this.#runTeardowns();
    this.#isClosed = true;

    return this.getIdentity();
  }

  isClosed(): boolean {
    return this.#isClosed;
  }

  getSnapshotState(): RepositorySnapshotState {
    return {
      activeRepository: this.getIdentity(),
      snapshot: this.#snapshot,
      error: this.#snapshotError,
      refreshState: this.#snapshotRefreshState,
      isStale: this.#isSnapshotStale,
      refreshedAt: this.#snapshotRefreshedAt,
    };
  }

  markSnapshotLoading(): RepositorySnapshotState {
    this.#assertOpen();
    this.#snapshotRefreshState = this.#snapshot ? "refreshing" : "loading";
    this.#isSnapshotStale = this.#snapshot !== null || this.#snapshotError !== null;
    return this.getSnapshotState();
  }

  markSnapshotStale(): RepositorySnapshotState {
    this.#assertOpen();

    if (this.#snapshot || this.#snapshotError) {
      this.#isSnapshotStale = true;
    }

    return this.getSnapshotState();
  }

  applySnapshot(snapshot: RepositorySnapshot): RepositorySnapshotState {
    this.#assertOpen();
    this.#snapshot = snapshot;
    this.#snapshotError = null;
    this.#snapshotRefreshState = "idle";
    this.#isSnapshotStale = false;
    this.#snapshotRefreshedAt = new Date().toISOString();
    return this.getSnapshotState();
  }

  applySnapshotError(error: AppShellError): RepositorySnapshotState {
    this.#assertOpen();
    this.#snapshotError = error;
    this.#snapshotRefreshState = "idle";
    this.#isSnapshotStale = false;

    if (!this.#snapshotRefreshedAt) {
      this.#snapshotRefreshedAt = new Date().toISOString();
    }

    return this.getSnapshotState();
  }

  registerTeardown(teardown: () => void): void {
    this.#assertOpen();
    this.#teardowns.add(teardown);
  }

  #assertOpen(): void {
    if (this.#isClosed) {
      throw new Error(`Repository session '${this.#identity.sessionId}' has already been closed.`);
    }
  }

  #runTeardowns(): void {
    for (const teardown of this.#teardowns) {
      teardown();
    }

    this.#teardowns.clear();
  }
}
