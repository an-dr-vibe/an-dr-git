import { RepositoryOperationQueue } from "../../src/main/repository/repository-operation-queue.js";

function defer<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe("RepositoryOperationQueue", () => {
  it("allows reads to run immediately", async () => {
    const queue = new RepositoryOperationQueue();
    const events: string[] = [];

    await Promise.all([
      queue.run("read", async () => {
        events.push("read-1");
      }),
      queue.run("read", async () => {
        events.push("read-2");
      }),
    ]);

    expect(events).toEqual(["read-1", "read-2"]);
  });

  it("serializes writes in arrival order", async () => {
    const queue = new RepositoryOperationQueue();
    const firstWriteGate = defer<void>();
    const firstWriteStarted = defer<void>();
    const events: string[] = [];

    const firstWrite = queue.run("write", async () => {
      events.push("write-1-start");
      firstWriteStarted.resolve();
      await firstWriteGate.promise;
      events.push("write-1-end");
    });

    const secondWrite = queue.run("write", async () => {
      events.push("write-2-start");
      events.push("write-2-end");
    });

    await firstWriteStarted.promise;
    expect(events).toEqual(["write-1-start"]);

    firstWriteGate.resolve();

    await Promise.all([firstWrite, secondWrite]);

    expect(events).toEqual(["write-1-start", "write-1-end", "write-2-start", "write-2-end"]);
  });

  it("continues with the next write after a failure", async () => {
    const queue = new RepositoryOperationQueue();
    const failure = queue.run("write", async () => {
      throw new Error("write failed");
    });

    await expect(failure).rejects.toThrow("write failed");
    await expect(queue.run("write", async () => "recovered")).resolves.toBe("recovered");
  });
});
