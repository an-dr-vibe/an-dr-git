import type {
  RepositoryDiffRequest,
  RepositoryDiffResult,
} from "../../shared/contracts/repository-diff.js";
import {
  repositoryDiffDocumentSchema,
  repositoryDiffResultSchema,
} from "../../shared/contracts/repository-diff.js";
import { validateContract } from "../../shared/contracts/app-shell.js";
import { executeGitCommand } from "../git/execute-git-command.js";
import { GitExecutableResolver } from "../git/git-executable-resolver.js";
import { RepositoryRegistry } from "./repository-registry.js";
import { parseRepositoryDiffDocument } from "./repository-diff-parser.js";

const DIFF_COMMAND_ARGS = ["diff", "--no-ext-diff", "--submodule=short", "--find-renames", "--find-copies"] as const;

export function createRepositoryDiffCommandArgs(filePath: string): string[] {
  return [...DIFF_COMMAND_ARGS, "--", filePath];
}

export class RepositoryDiffService {
  readonly #gitExecutableResolver: GitExecutableResolver;
  readonly #repositoryRegistry: RepositoryRegistry;

  constructor(gitExecutableResolver: GitExecutableResolver, repositoryRegistry: RepositoryRegistry) {
    this.#gitExecutableResolver = gitExecutableResolver;
    this.#repositoryRegistry = repositoryRegistry;
  }

  async getDiff(request: RepositoryDiffRequest): Promise<RepositoryDiffResult> {
    const session = this.#repositoryRegistry.getBySessionId(request.sessionId);

    if (!session || session.isClosed()) {
      return validateContract(
        repositoryDiffResultSchema,
        {
          kind: "error",
          activeRepository: null,
          request,
          error: {
            code: "SESSION_NOT_FOUND",
            summary: "The repository session is no longer available.",
            detail: "Open the repository again before requesting a diff.",
          },
        },
        "repository diff error response"
      );
    }

    const resolvedGit = await this.#gitExecutableResolver.getResolvedExecutable();

    if ("code" in resolvedGit) {
      return validateContract(
        repositoryDiffResultSchema,
        {
          kind: "error",
          activeRepository: session.getIdentity(),
          request,
          error: resolvedGit,
        },
        "repository diff error response"
      );
    }

    const identity = session.getIdentity();
    const result = await session.runOperation("read", async () =>
      executeGitCommand(
        this.#gitExecutableResolver.getCommandName(),
        createRepositoryDiffCommandArgs(request.filePath),
        {
          cwd: identity.rootPath,
          env: this.#gitExecutableResolver.getCommandEnv(),
          timeoutMs: 10_000,
          operationKind: "read",
          operationName: "repository:diff",
          repositoryPath: identity.rootPath,
          sessionId: identity.sessionId,
        }
      )
    );

    if (result.exitCode !== 0 || result.spawnError || result.timedOut) {
      return validateContract(
        repositoryDiffResultSchema,
        {
          kind: "error",
          activeRepository: identity,
          request,
          error: {
            code: "UNEXPECTED",
            summary: "Git could not build the requested diff.",
            detail: "The repository is open, but the diff command did not complete successfully.",
            repositoryPath: identity.rootPath,
            stderr: result.stderr.trim() || result.stdout.trim() || result.spawnError?.message || undefined,
          },
        },
        "repository diff error response"
      );
    }

    const document = validateContract(
      repositoryDiffDocumentSchema,
      parseRepositoryDiffDocument(request.filePath, result.stdout),
      "repository diff document"
    );

    return validateContract(
      repositoryDiffResultSchema,
      {
        kind: "loaded",
        activeRepository: identity,
        request,
        document,
      },
      "repository diff loaded response"
    );
  }
}
