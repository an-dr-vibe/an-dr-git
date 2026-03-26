import { spawn } from "node:child_process";

export interface CommandExecutionResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly spawnError: NodeJS.ErrnoException | null;
}

interface RunCommandOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions = {}
): Promise<CommandExecutionResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let spawnError: NodeJS.ErrnoException | null = null;

    const finalize = (exitCode: number | null): void => {
      if (settled) {
        return;
      }

      settled = true;

      resolve({
        command,
        args,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode,
        durationMs: Date.now() - startedAt,
        spawnError,
      });
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnError = error;
      finalize(null);
    });

    child.on("close", (exitCode: number | null) => {
      finalize(exitCode);
    });

    if (options.timeoutMs) {
      setTimeout(() => {
        if (!settled) {
          child.kill();
        }
      }, options.timeoutMs).unref();
    }
  });
}
