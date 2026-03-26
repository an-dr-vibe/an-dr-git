import { join } from "node:path";

import { createAppShellHandlers } from "../../src/main/ipc/create-app-shell-handlers.js";
import { GitExecutableResolver } from "../../src/main/git/git-executable-resolver.js";
import { RepositoryRegistry } from "../../src/main/repository/repository-registry.js";
import { RepositorySnapshotService } from "../../src/main/repository/repository-snapshot-service.js";
import {
  createRepositoryFixture,
  createTempDirectory,
} from "../helpers/git-test-helpers.js";

describe("app shell handlers integration", () => {
  it("detects system git through the shared handler contract", async () => {
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const result = await handlers.getGitStatus();

    expect(result.kind).toBe("ready");

    if (result.kind !== "ready") {
      return;
    }

    expect(result.version.length).toBeGreaterThan(0);
    expect(result.executablePath.length).toBeGreaterThan(0);
  });

  it("rejects invalid payloads through the IPC handler layer", async () => {
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const result = await handlers.openRepository({ repositoryPath: "   " });

    expect(result.kind).toBe("error");

    if (result.kind !== "error") {
      return;
    }

    expect(result.error.code).toBe("INVALID_PAYLOAD");
  });

  it("opens a valid repository and creates a session-owned identity", async () => {
    const repositoryPath = await createRepositoryFixture();
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const result = await handlers.openRepository({ repositoryPath });

    expect(result.kind).toBe("opened");

    if (result.kind !== "opened") {
      return;
    }

    expect(result.repository.rootPath).toBe(repositoryPath);
    expect(result.repository.sessionId.length).toBeGreaterThan(0);
    expect(result.repository.gitDirectoryPath.length).toBeGreaterThan(0);
    expect(repositoryRegistry.getActive()?.sessionId).toBe(result.repository.sessionId);
  });

  it("reuses the existing session when the same repository is opened again", async () => {
    const repositoryPath = await createRepositoryFixture();
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const firstResult = await handlers.openRepository({ repositoryPath });
    const secondResult = await handlers.openRepository({ repositoryPath });

    expect(firstResult.kind).toBe("opened");
    expect(secondResult.kind).toBe("opened");

    if (firstResult.kind !== "opened" || secondResult.kind !== "opened") {
      return;
    }

    expect(secondResult.repository.sessionId).toBe(firstResult.repository.sessionId);
    expect(repositoryRegistry.list()).toHaveLength(1);
  });

  it("fails clearly when the repository path is missing", async () => {
    const missingPath = join(await createTempDirectory("an-dr-git-missing-parent-"), "missing");
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const result = await handlers.openRepository({ repositoryPath: missingPath });

    expect(result.kind).toBe("error");

    if (result.kind !== "error") {
      return;
    }

    expect(result.error.code).toBe("PATH_NOT_FOUND");
  });

  it("fails clearly when the selected folder is not a repository", async () => {
    const directoryPath = await createTempDirectory("an-dr-git-non-repo-");
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const result = await handlers.openRepository({ repositoryPath: directoryPath });

    expect(result.kind).toBe("error");

    if (result.kind !== "error") {
      return;
    }

    expect(result.error.code).toBe("NOT_A_REPOSITORY");
  });

  it("refreshes a repository snapshot through the shared handler contract", async () => {
    const repositoryPath = await createRepositoryFixture();
    const repositoryRegistry = new RepositoryRegistry();
    const gitExecutableResolver = new GitExecutableResolver();
    const handlers = createAppShellHandlers({
      isPackaged: false,
      gitExecutableResolver,
      repositoryRegistry,
      repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
      pickRepositoryPath: async () => null,
    });

    const openResult = await handlers.openRepository({ repositoryPath });

    expect(openResult.kind).toBe("opened");

    const snapshotState = await handlers.refreshRepositorySnapshot();

    expect(snapshotState.activeRepository?.rootPath).toBe(repositoryPath);
    expect(snapshotState.snapshot?.branches.local.length).toBeGreaterThan(0);
    expect(snapshotState.snapshot?.tree.length).toBeGreaterThan(0);
  });
});
