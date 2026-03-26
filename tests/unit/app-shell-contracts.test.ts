import {
  appShellBootstrapSchema,
  createInvalidPayloadError,
  gitStatusSchema,
  openRepositoryRequestSchema,
  openRepositoryResultSchema,
  repositorySnapshotStateSchema,
} from "../../src/shared/contracts/app-shell.js";
import {
  repositoryDiffRequestSchema,
  repositoryDiffResultSchema,
} from "../../src/shared/contracts/repository-diff.js";

describe("app shell contracts", () => {
  it("accepts bootstrap payloads that match the shared contract", () => {
    expect(
      appShellBootstrapSchema.parse({
        appName: "an-dr-git",
        shellVersion: "phase-0-slice-0.5",
        platform: "win32",
        isPackaged: false,
        sessionContainerLabel: "Repository Sessions",
      })
    ).toMatchObject({
      appName: "an-dr-git",
      platform: "win32",
    });
  });

  it("rejects blank repository paths", () => {
    expect(() => openRepositoryRequestSchema.parse({ repositoryPath: "   " })).toThrow();
  });

  it("defines a structured git status response", () => {
    expect(
      gitStatusSchema.parse({
        kind: "ready",
        executablePath: "/usr/bin/git",
        version: "2.43.0",
      })
    ).toMatchObject({
      kind: "ready",
      version: "2.43.0",
    });
  });

  it("defines a structured repository open error response", () => {
    expect(
      openRepositoryResultSchema.parse({
        kind: "error",
        error: {
          code: "NOT_A_REPOSITORY",
          summary: "The selected folder is not a Git repository.",
          detail: "Open a working tree folder.",
          repositoryPath: "/tmp/demo",
          stderr: "fatal: not a git repository",
        },
      })
    ).toMatchObject({
      kind: "error",
      error: {
        code: "NOT_A_REPOSITORY",
      },
    });
  });

  it("formats invalid payloads as user-visible errors", () => {
    const parsed = openRepositoryRequestSchema.safeParse({ repositoryPath: "" });

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      return;
    }

    expect(createInvalidPayloadError("open repository request", parsed.error)).toMatchObject({
      code: "INVALID_PAYLOAD",
      summary: "The request payload was invalid.",
    });
  });

  it("defines a structured repository snapshot state", () => {
    expect(
      repositorySnapshotStateSchema.parse({
        activeRepository: null,
        snapshot: null,
        error: null,
        refreshState: "idle",
        isStale: false,
        refreshedAt: null,
      })
    ).toMatchObject({
      refreshState: "idle",
      isStale: false,
    });
  });

  it("defines a typed repository diff request", () => {
    expect(
      repositoryDiffRequestSchema.parse({
        sessionId: "session-1",
        filePath: "src/app.ts",
      })
    ).toMatchObject({
      sessionId: "session-1",
    });
  });

  it("defines a typed repository diff result with raw fallback", () => {
    expect(
      repositoryDiffResultSchema.parse({
        kind: "loaded",
        activeRepository: {
          sessionId: "session-1",
          rootPath: "/repo",
          gitDirectoryPath: "/repo/.git",
          currentHead: "main",
          isDetached: false,
          isUnborn: false,
        },
        request: {
          sessionId: "session-1",
          filePath: "src/app.ts",
        },
        document: {
          requestedPath: "src/app.ts",
          parseState: "partial",
          rawText: "diff --git a/src/app.ts b/src/app.ts",
          warnings: ["Unsupported hunk line"],
          files: [
            {
              oldPath: "src/app.ts",
              newPath: "src/app.ts",
              displayPath: "src/app.ts",
              changeType: "modified",
              markers: ["no-newline"],
              headerLines: ["diff --git a/src/app.ts b/src/app.ts"],
              hunks: [],
            },
          ],
        },
      })
    ).toMatchObject({
      kind: "loaded",
      document: {
        parseState: "partial",
      },
    });
  });
});
