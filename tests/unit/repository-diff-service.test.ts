import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { GitExecutableResolver } from "../../src/main/git/git-executable-resolver.js";
import {
  createRepositoryDiffCommandArgs,
  RepositoryDiffService,
} from "../../src/main/repository/repository-diff-service.js";
import { RepositoryRegistry } from "../../src/main/repository/repository-registry.js";
import { createRepositoryFixture } from "../helpers/git-test-helpers.js";

describe("repository diff service", () => {
  it("builds explicit git diff arguments for a selected file", () => {
    expect(createRepositoryDiffCommandArgs("src/app.ts")).toEqual([
      "diff",
      "--no-ext-diff",
      "--submodule=short",
      "--find-renames",
      "--find-copies",
      "--",
      "src/app.ts",
    ]);
  });

  it("returns a structured error when the session does not exist", async () => {
    const service = new RepositoryDiffService(new GitExecutableResolver(), new RepositoryRegistry());

    const result = await service.getDiff({
      sessionId: "missing-session",
      filePath: "README.md",
    });

    expect(result.kind).toBe("error");

    if (result.kind !== "error") {
      return;
    }

    expect(result.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("surfaces git resolution failures as structured diff errors", async () => {
    const repositoryPath = await createRepositoryFixture();
    const registry = new RepositoryRegistry();
    const repository = registry.activate({
      rootPath: repositoryPath,
      gitDirectoryPath: join(repositoryPath, ".git"),
      currentHead: "master",
      isDetached: false,
      isUnborn: false,
    });
    const resolver = new GitExecutableResolver({ gitCommand: "an-dr-git-missing-diff-git" });
    const service = new RepositoryDiffService(resolver, registry);

    const result = await service.getDiff({
      sessionId: repository.sessionId,
      filePath: "README.md",
    });

    expect(result.kind).toBe("error");

    if (result.kind !== "error") {
      return;
    }

    expect(result.error.code).toBe("GIT_MISSING");
  });

  it("loads a real repository diff through the service", async () => {
    const repositoryPath = await createRepositoryFixture();
    await writeFile(join(repositoryPath, "README.md"), "# fixture\nupdated\n", "utf8");

    const registry = new RepositoryRegistry();
    const repository = registry.activate({
      rootPath: repositoryPath,
      gitDirectoryPath: join(repositoryPath, ".git"),
      currentHead: "master",
      isDetached: false,
      isUnborn: false,
    });
    const service = new RepositoryDiffService(new GitExecutableResolver(), registry);

    const result = await service.getDiff({
      sessionId: repository.sessionId,
      filePath: "README.md",
    });

    expect(result.kind).toBe("loaded");

    if (result.kind !== "loaded") {
      return;
    }

    expect(result.document.parseState).toBe("parsed");
    expect(result.document.files[0]?.displayPath).toBe("README.md");
    expect(result.document.rawText).toContain("diff --git");
  });

  it("returns an empty diff for an untracked file without pretending Git produced a patch", async () => {
    const repositoryPath = await createRepositoryFixture();
    await writeFile(join(repositoryPath, "draft.txt"), "hello\n", "utf8");

    const registry = new RepositoryRegistry();
    const repository = registry.activate({
      rootPath: repositoryPath,
      gitDirectoryPath: join(repositoryPath, ".git"),
      currentHead: "master",
      isDetached: false,
      isUnborn: false,
    });
    const service = new RepositoryDiffService(new GitExecutableResolver(), registry);

    const result = await service.getDiff({
      sessionId: repository.sessionId,
      filePath: "draft.txt",
    });

    expect(result.kind).toBe("loaded");

    if (result.kind !== "loaded") {
      return;
    }

    expect(result.document.parseState).toBe("empty");
    expect(result.document.rawText).toBe("");
  });

  it("surfaces command execution failures without hiding stderr context", async () => {
    const repositoryPath = await createRepositoryFixture();
    const registry = new RepositoryRegistry();
    const repository = registry.activate({
      rootPath: repositoryPath,
      gitDirectoryPath: join(repositoryPath, ".git"),
      currentHead: "master",
      isDetached: false,
      isUnborn: false,
    });
    const fakeResolver = {
      async getResolvedExecutable() {
        return {
          executablePath: "git",
          version: "2.0.0",
        };
      },
      getCommandName() {
        return "an-dr-git-missing-diff-command";
      },
      getCommandEnv() {
        return process.env;
      },
    } as unknown as GitExecutableResolver;
    const service = new RepositoryDiffService(fakeResolver, registry);

    const result = await service.getDiff({
      sessionId: repository.sessionId,
      filePath: "README.md",
    });

    expect(result.kind).toBe("error");

    if (result.kind !== "error") {
      return;
    }

    expect(result.error.code).toBe("UNEXPECTED");
    expect(result.error.stderr?.length ?? 0).toBeGreaterThan(0);
  });
});
