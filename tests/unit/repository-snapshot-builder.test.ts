import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { GitExecutableResolver } from "../../src/main/git/git-executable-resolver.js";
import {
  buildBranchSummaries,
  buildRepositorySnapshot,
  buildTreeNodes,
  parseNullSeparatedPaths,
  parseStatusPorcelainV2,
} from "../../src/main/repository/repository-snapshot-builder.js";
import type { RepositoryIdentity } from "../../src/shared/contracts/app-shell.js";
import {
  createRepositoryFixture,
  runGitInDirectory,
} from "../helpers/git-test-helpers.js";

describe("repository snapshot builder", () => {
  it("parses status porcelain branch headers and entries", () => {
    const parsed = parseStatusPorcelainV2(
      [
        "# branch.oid 0123456789abcdef",
        "# branch.head feature/demo",
        "# branch.upstream origin/feature/demo",
        "# branch.ab +2 -1",
      ].join("\n") +
        "\n" +
        [
          "1 .M N... 100644 100644 100644 0123456789abcdef 0123456789abcdef src/app.ts",
          "? notes.txt",
          "! dist/output.js",
          "",
        ].join("\0")
    );

    expect(parsed.headers.branchName).toBe("feature/demo");
    expect(parsed.headers.upstreamName).toBe("origin/feature/demo");
    expect(parsed.headers.aheadCount).toBe(2);
    expect(parsed.headers.behindCount).toBe(1);
    expect(parsed.entries.get("src/app.ts")?.change).toBe("modified");
    expect(parsed.entries.get("notes.txt")?.change).toBe("untracked");
    expect(parsed.entries.get("dist/output.js")?.change).toBe("ignored");
  });

  it("splits null-separated path lists", () => {
    expect(parseNullSeparatedPaths("README.md\0src/main.ts\0")).toEqual(["README.md", "src/main.ts"]);
  });

  it("builds a virtual tree with aggregated directory state", () => {
    const tree = buildTreeNodes(
      ["README.md", "src/main.ts", "src/clean.ts"],
      ["scratch.txt"],
      ["dist/out.js"],
      new Map([
        ["src/main.ts", { path: "src/main.ts", change: "modified" }],
        ["legacy.txt", { path: "legacy.txt", change: "deleted" }],
      ])
    );

    expect(tree.map((node) => node.path)).toEqual(["dist", "src", "legacy.txt", "README.md", "scratch.txt"]);
    expect(tree[1]?.change).toBe("modified");
    expect(tree[2]?.change).toBe("deleted");
    expect(tree[4]?.change).toBe("untracked");
  });

  it("maps local and remote branches with tracking state", () => {
    const repository: RepositoryIdentity = {
      sessionId: "session-1",
      rootPath: "/repo",
      gitDirectoryPath: "/repo/.git",
      currentHead: "main",
      isDetached: false,
      isUnborn: false,
    };
    const branches = buildBranchSummaries(
      repository,
      {
        branchName: "main",
        isDetached: false,
        isUnborn: false,
        upstreamName: "origin/main",
        aheadCount: 1,
        behindCount: 0,
        commitSha: "abc1234",
      },
      [
        "refs/heads/main\u001fmain\u001fabc1234\u001f*\u001forigin/main\u001fahead 1\u001e",
        "refs/remotes/origin/main\u001forigin/main\u001fdef5678\u001f\u001f\u001f\u001e",
      ].join("")
    );

    expect(branches.local[0]).toMatchObject({
      name: "main",
      isCurrent: true,
      upstreamName: "origin/main",
      trackingStatus: "tracking",
      aheadCount: 1,
    });
    expect(branches.remote[0]).toMatchObject({
      name: "origin/main",
      kind: "remote",
    });
  });

  it("builds a repository snapshot from real git output", async () => {
    const repositoryPath = await createRepositoryFixture();

    await writeFile(join(repositoryPath, "src-demo.txt"), "modified\n", "utf8");
    await runGitInDirectory(repositoryPath, ["checkout", "-b", "feature/snapshot"]);
    await runGitInDirectory(repositoryPath, ["branch", "--set-upstream-to", "origin/missing", "feature/snapshot"]).catch(
      () => undefined
    );

    const repository: RepositoryIdentity = {
      sessionId: "session-1",
      rootPath: repositoryPath,
      gitDirectoryPath: join(repositoryPath, ".git"),
      currentHead: "feature/snapshot",
      isDetached: false,
      isUnborn: false,
    };

    const result = await buildRepositorySnapshot(repository, new GitExecutableResolver());

    expect("snapshot" in result).toBe(true);

    if (!("snapshot" in result)) {
      return;
    }

    expect(result.snapshot.head.label).toBe("feature/snapshot");
    expect(result.snapshot.branches.local.some((branch) => branch.name === "feature/snapshot")).toBe(true);
    expect(result.snapshot.tree.some((node) => node.path === "src-demo.txt")).toBe(true);
  });
});
