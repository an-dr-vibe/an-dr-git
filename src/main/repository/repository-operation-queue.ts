export type RepositoryOperationKind = "read" | "write";

export class RepositoryOperationQueue {
  #pendingWrite: Promise<void> = Promise.resolve();

  async run<T>(kind: RepositoryOperationKind, work: () => Promise<T>): Promise<T> {
    if (kind === "read") {
      return work();
    }

    const startAfter = this.#pendingWrite.catch(() => undefined);
    let releaseCurrentWrite = (): void => undefined;

    this.#pendingWrite = new Promise<void>((resolve) => {
      releaseCurrentWrite = resolve;
    });

    await startAfter;

    try {
      return await work();
    } finally {
      releaseCurrentWrite();
    }
  }
}
