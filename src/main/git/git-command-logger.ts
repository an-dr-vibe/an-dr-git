import type { CommandExecutionResult } from "./run-command.js";

export type GitOperationKind = "system" | "read" | "write";

export interface GitCommandContext {
  readonly operationName: string;
  readonly operationKind: GitOperationKind;
  readonly repositoryPath?: string;
  readonly sessionId?: string;
}

export interface GitCommandLogEntry {
  readonly scope: "git-command";
  readonly operationName: string;
  readonly operationKind: GitOperationKind;
  readonly command: string;
  readonly args: readonly string[];
  readonly workingDirectory: string | null;
  readonly repositoryPath: string | null;
  readonly sessionId: string | null;
  readonly durationMs: number;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly spawnErrorCode: string | null;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
}

export function createGitCommandLogEntry(
  result: CommandExecutionResult,
  context: GitCommandContext
): GitCommandLogEntry {
  return {
    scope: "git-command",
    operationName: context.operationName,
    operationKind: context.operationKind,
    command: result.command,
    args: result.args,
    workingDirectory: result.cwd ?? null,
    repositoryPath: context.repositoryPath ?? result.cwd ?? null,
    sessionId: context.sessionId ?? null,
    durationMs: result.durationMs,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    spawnErrorCode: result.spawnError?.code ?? null,
    stdoutBytes: Buffer.byteLength(result.stdout, "utf8"),
    stderrBytes: Buffer.byteLength(result.stderr, "utf8"),
  };
}

export function logGitCommandResult(result: CommandExecutionResult, context: GitCommandContext): void {
  const entry = createGitCommandLogEntry(result, context);
  const serializedEntry = JSON.stringify(entry);

  if (result.exitCode === 0 && !result.spawnError && !result.timedOut) {
    console.info(serializedEntry);
    return;
  }

  console.error(serializedEntry);
}
