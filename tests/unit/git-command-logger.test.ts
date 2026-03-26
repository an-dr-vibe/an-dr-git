import { createGitCommandLogEntry } from "../../src/main/git/git-command-logger.js";

describe("git command logger", () => {
  it("builds a structured log entry for git execution", () => {
    const entry = createGitCommandLogEntry(
      {
        command: "git",
        args: ["status", "--short"],
        cwd: "C:\\repos\\demo",
        stdout: "M README.md\n",
        stderr: "",
        exitCode: 0,
        durationMs: 12,
        timedOut: false,
        spawnError: null,
      },
      {
        operationName: "refresh-status",
        operationKind: "read",
        repositoryPath: "C:\\repos\\demo",
        sessionId: "session-1",
      }
    );

    expect(entry).toMatchObject({
      scope: "git-command",
      operationName: "refresh-status",
      operationKind: "read",
      command: "git",
      repositoryPath: "C:\\repos\\demo",
      sessionId: "session-1",
      exitCode: 0,
      timedOut: false,
      stdoutBytes: 12,
      stderrBytes: 0,
    });
  });
});
