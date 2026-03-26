import {
  type AppShellError,
  type GitStatus,
} from "../../shared/contracts/app-shell.js";
import { executeGitCommand } from "./execute-git-command.js";

export interface ResolvedGitExecutable {
  readonly executablePath: string;
  readonly version: string;
}

interface GitExecutableResolverOptions {
  readonly gitCommand?: string;
  readonly env?: NodeJS.ProcessEnv;
}

const COMMAND_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_PAGER: "cat",
  TERM: "dumb",
  LC_ALL: "C",
};

export class GitExecutableResolver {
  readonly #gitCommand: string;
  readonly #env: NodeJS.ProcessEnv;
  #cachedStatus: GitStatus | null = null;

  constructor(options: GitExecutableResolverOptions = {}) {
    this.#gitCommand = options.gitCommand ?? "git";
    this.#env = {
      ...COMMAND_ENV,
      ...options.env,
    };
  }

  async resolveStatus(): Promise<GitStatus> {
    if (this.#cachedStatus) {
      return this.#cachedStatus;
    }

    const versionResult = await executeGitCommand(this.#gitCommand, ["--version"], {
      env: this.#env,
      timeoutMs: 10_000,
      operationKind: "system",
      operationName: "detect-git-version",
    });

    if (versionResult.spawnError) {
      const status: GitStatus = {
        kind: "missing",
        error: this.#createMissingGitError(versionResult.spawnError.message),
      };

      this.#cachedStatus = status;
      return status;
    }

    if (versionResult.exitCode !== 0) {
      const status: GitStatus = {
        kind: "unusable",
        error: {
          code: "GIT_UNUSABLE",
          summary: "System Git could not be executed.",
          detail: "The Git executable responded with an error during version detection.",
          stderr: versionResult.stderr.trim() || versionResult.stdout.trim() || undefined,
        },
      };

      this.#cachedStatus = status;
      return status;
    }

    const versionText = versionResult.stdout.trim();
    const versionMatch = /^git version (?<version>.+)$/u.exec(versionText);

    if (!versionMatch?.groups?.version) {
      const status: GitStatus = {
        kind: "unusable",
        error: {
          code: "GIT_UNUSABLE",
          summary: "System Git returned an unexpected version string.",
          detail: `Expected 'git version <value>' but received '${versionText || "<empty>"}'.`,
        },
      };

      this.#cachedStatus = status;
      return status;
    }

    const executablePath = await this.#resolveExecutablePath();
    const status: GitStatus = {
      kind: "ready",
      executablePath,
      version: versionMatch.groups.version,
    };

    this.#cachedStatus = status;
    return status;
  }

  async getResolvedExecutable(): Promise<ResolvedGitExecutable | AppShellError> {
    const status = await this.resolveStatus();

    if (status.kind !== "ready") {
      return status.error;
    }

    return {
      executablePath: status.executablePath,
      version: status.version,
    };
  }

  getCommandEnv(): NodeJS.ProcessEnv {
    return { ...this.#env };
  }

  getCommandName(): string {
    return this.#gitCommand;
  }

  invalidateCache(): void {
    this.#cachedStatus = null;
  }

  async #resolveExecutablePath(): Promise<string> {
    const locator =
      process.platform === "win32"
        ? { command: "where.exe", args: [this.#gitCommand] }
        : { command: "which", args: [this.#gitCommand] };

    const result = await executeGitCommand(locator.command, locator.args, {
      env: this.#env,
      timeoutMs: 10_000,
      operationKind: "system",
      operationName: "locate-git-executable",
    });

    if (result.exitCode === 0 && result.stdout.trim().length > 0) {
      return result.stdout.split(/\r?\n/u, 1)[0]?.trim() || this.#gitCommand;
    }

    return this.#gitCommand;
  }

  #createMissingGitError(detail: string): AppShellError {
    return {
      code: "GIT_MISSING",
      summary: "System Git was not found.",
      detail:
        "Install Git and make sure it is available on PATH before opening a repository in an-dr-git.",
      stderr: detail,
    };
  }
}
