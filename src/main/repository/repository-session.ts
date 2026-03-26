import type { RepositoryIdentity } from "../../shared/contracts/app-shell.js";
import {
  RepositoryOperationQueue,
  type RepositoryOperationKind,
} from "./repository-operation-queue.js";

export class RepositorySession {
  readonly #operationQueue = new RepositoryOperationQueue();
  #identity: RepositoryIdentity;
  #isClosed = false;

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
    this.#isClosed = true;

    return this.getIdentity();
  }

  isClosed(): boolean {
    return this.#isClosed;
  }

  #assertOpen(): void {
    if (this.#isClosed) {
      throw new Error(`Repository session '${this.#identity.sessionId}' has already been closed.`);
    }
  }
}
