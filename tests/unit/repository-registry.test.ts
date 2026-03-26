import { RepositoryRegistry } from "../../src/main/repository/repository-registry.js";

function createSeed(rootPath: string, currentHead = "main") {
  return {
    rootPath,
    gitDirectoryPath: `${rootPath}\\.git`,
    currentHead,
    isDetached: false,
    isUnborn: false,
  };
}

describe("RepositoryRegistry", () => {
  it("creates a reusable session per repository root", () => {
    const registry = new RepositoryRegistry();
    const firstOpen = registry.activate(createSeed("C:\\repos\\one", "main"));
    const reopened = registry.activate(createSeed("C:\\repos\\one", "feature/test"));

    expect(reopened.sessionId).toBe(firstOpen.sessionId);
    expect(reopened.currentHead).toBe("feature/test");
    expect(registry.list()).toHaveLength(1);
    expect(registry.getActive()?.sessionId).toBe(firstOpen.sessionId);
  });

  it("tracks multiple sessions and allows explicit activation", () => {
    const registry = new RepositoryRegistry();
    const first = registry.activate(createSeed("C:\\repos\\one"));
    const second = registry.activate(createSeed("C:\\repos\\two", "develop"));

    expect(registry.list().map((session) => session.rootPath)).toEqual([
      "C:\\repos\\one",
      "C:\\repos\\two",
    ]);
    expect(registry.getActive()?.sessionId).toBe(second.sessionId);
    expect(registry.activateSession(first.sessionId)?.sessionId).toBe(first.sessionId);
    expect(registry.getActive()?.sessionId).toBe(first.sessionId);
  });

  it("closes sessions and moves the active pointer safely", () => {
    const registry = new RepositoryRegistry();
    const first = registry.activate(createSeed("C:\\repos\\one"));
    const second = registry.activate(createSeed("C:\\repos\\two"));

    expect(registry.close(second.sessionId)?.sessionId).toBe(second.sessionId);
    expect(registry.getActive()?.sessionId).toBe(first.sessionId);
    expect(registry.getBySessionId(second.sessionId)).toBeNull();
    expect(registry.close(first.sessionId)?.sessionId).toBe(first.sessionId);
    expect(registry.getActive()).toBeNull();
  });
});
