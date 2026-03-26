import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type {
  AppShellError,
  OpenRepositoryRequest,
  OpenRepositoryResult,
} from "../../shared/contracts/app-shell.js";
import { runCommand } from "../git/run-command.js";
import { GitExecutableResolver } from "../git/git-executable-resolver.js";
import { RepositoryRegistry } from "./repository-registry.js";

function isAppShellError(value: unknown): value is AppShellError {
  return typeof value === "object" && value !== null && "code" in value;
}

export class RepositoryOpener {
  readonly #gitExecutableResolver: GitExecutableResolver;
  readonly #repositoryRegistry: RepositoryRegistry;

  constructor(gitExecutableResolver: GitExecutableResolver, repositoryRegistry: RepositoryRegistry) {
    this.#gitExecutableResolver = gitExecutableResolver;
    this.#repositoryRegistry = repositoryRegistry;
  }

  async openRepository(request: OpenRepositoryRequest): Promise<OpenRepositoryResult> {
    const resolvedGit = await this.#gitExecutableResolver.getResolvedExecutable();

    if (isAppShellError(resolvedGit)) {
      return {
        kind: "error",
        error: resolvedGit,
      };
    }

    const pathValidationError = await this.#validateRepositoryPath(request.repositoryPath);

    if (pathValidationError) {
      return {
        kind: "error",
        error: pathValidationError,
      };
    }

    const repositoryRoot = await this.#resolveRepositoryRoot(request.repositoryPath);

    if (isAppShellError(repositoryRoot)) {
      return {
        kind: "error",
        error: repositoryRoot,
      };
    }

    const workTreeCheck = await this.#runGit(repositoryRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (workTreeCheck.exitCode !== 0 || workTreeCheck.stdout.trim() !== "true") {
      return {
        kind: "error",
        error: {
          code: "UNSUPPORTED_REPOSITORY",
          summary: "The selected repository does not have a working tree.",
          detail: "Bare repositories are not supported in the current phase of an-dr-git.",
          repositoryPath: repositoryRoot,
          stderr: workTreeCheck.stderr.trim() || undefined,
        },
      };
    }

    const gitDirectoryResult = await this.#runGit(repositoryRoot, ["rev-parse", "--git-dir"]);
    if (gitDirectoryResult.exitCode !== 0) {
      return {
        kind: "error",
        error: {
          code: "UNEXPECTED",
          summary: "Git could not resolve the repository metadata path.",
          detail: "The repository root was found, but Git could not report the .git location.",
          repositoryPath: repositoryRoot,
          stderr: gitDirectoryResult.stderr.trim() || undefined,
        },
      };
    }

    const gitDirectoryPath = this.#resolveGitPath(repositoryRoot, gitDirectoryResult.stdout.trim());
    const headState = await this.#resolveHeadState(repositoryRoot);

    if (isAppShellError(headState)) {
      return {
        kind: "error",
        error: headState,
      };
    }

    return {
      kind: "opened",
      repository: this.#repositoryRegistry.activate({
        rootPath: repositoryRoot,
        gitDirectoryPath,
        currentHead: headState.currentHead,
        isDetached: headState.isDetached,
        isUnborn: headState.isUnborn,
      }),
    };
  }

  async #validateRepositoryPath(repositoryPath: string): Promise<AppShellError | null> {
    try {
      const pathStats = await lstat(repositoryPath);

      if (!pathStats.isDirectory()) {
        return {
          code: "PATH_NOT_DIRECTORY",
          summary: "The selected path is not a directory.",
          detail: "Choose a repository folder rather than a file path.",
          repositoryPath,
        };
      }

      return null;
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error) {
        const filesystemError = error as NodeJS.ErrnoException;

        if (filesystemError.code === "ENOENT") {
          return {
            code: "PATH_NOT_FOUND",
            summary: "The selected path does not exist.",
            detail: "Choose a local folder that exists on disk.",
            repositoryPath,
          };
        }

        if (filesystemError.code === "EACCES" || filesystemError.code === "EPERM") {
          return {
            code: "PATH_NOT_ACCESSIBLE",
            summary: "The selected path is not accessible.",
            detail: "an-dr-git could not read the selected folder because the operating system denied access.",
            repositoryPath,
            stderr: filesystemError.message,
          };
        }
      }

      return {
        code: "UNEXPECTED",
        summary: "The selected path could not be inspected.",
        detail: error instanceof Error ? error.message : "Unknown filesystem error.",
        repositoryPath,
      };
    }
  }

  async #resolveRepositoryRoot(repositoryPath: string): Promise<string | AppShellError> {
    const topLevelResult = await this.#runGit(repositoryPath, ["rev-parse", "--show-toplevel"]);

    if (topLevelResult.exitCode !== 0) {
      return {
        code: "NOT_A_REPOSITORY",
        summary: "The selected folder is not a Git repository.",
        detail:
          "Open a working tree folder that Git can resolve with 'git rev-parse --show-toplevel'.",
        repositoryPath,
        stderr: topLevelResult.stderr.trim() || undefined,
      };
    }

    const topLevelPath = topLevelResult.stdout.trim();

    try {
      return await realpath(topLevelPath);
    } catch {
      return topLevelPath;
    }
  }

  async #resolveHeadState(
    repositoryRoot: string
  ): Promise<{ currentHead: string; isDetached: boolean; isUnborn: boolean } | AppShellError> {
    const symbolicHead = await this.#runGit(repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const verifyHead = await this.#runGit(repositoryRoot, ["rev-parse", "--verify", "HEAD"]);

    if (symbolicHead.exitCode === 0) {
      return {
        currentHead: symbolicHead.stdout.trim(),
        isDetached: false,
        isUnborn: verifyHead.exitCode !== 0,
      };
    }

    if (verifyHead.exitCode === 0) {
      const shortHead = await this.#runGit(repositoryRoot, ["rev-parse", "--short", "HEAD"]);
      return {
        currentHead: shortHead.exitCode === 0 ? shortHead.stdout.trim() : verifyHead.stdout.trim().slice(0, 7),
        isDetached: true,
        isUnborn: false,
      };
    }

    return {
      code: "UNEXPECTED",
      summary: "Git could not determine the repository HEAD state.",
      detail: "The repository opened, but HEAD could not be resolved as a branch, detached commit, or unborn branch.",
      repositoryPath: repositoryRoot,
      stderr: symbolicHead.stderr.trim() || verifyHead.stderr.trim() || undefined,
    };
  }

  async #runGit(repositoryPath: string, args: readonly string[]) {
    return runCommand(this.#gitExecutableResolver.getCommandName(), args, {
      cwd: repositoryPath,
      env: this.#gitExecutableResolver.getCommandEnv(),
      timeoutMs: 10_000,
    });
  }

  #resolveGitPath(repositoryRoot: string, gitDirectoryPath: string): string {
    if (isAbsolute(gitDirectoryPath)) {
      return gitDirectoryPath;
    }

    return resolve(repositoryRoot, gitDirectoryPath);
  }
}
