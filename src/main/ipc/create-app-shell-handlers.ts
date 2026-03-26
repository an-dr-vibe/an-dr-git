import type {
  AppShellBootstrap,
  AppShellError,
  GitStatus,
  OpenRepositoryResult,
} from "../../shared/contracts/app-shell.js";
import {
  appShellBootstrapSchema,
  createInvalidPayloadError,
  gitStatusSchema,
  openRepositoryRequestSchema,
  openRepositoryResultSchema,
  validateContract,
} from "../../shared/contracts/app-shell.js";
import { createAppShellBootstrap } from "../app/app-shell-bootstrap.js";
import { GitExecutableResolver } from "../git/git-executable-resolver.js";
import { RepositoryOpener } from "../repository/open-repository.js";
import { RepositoryRegistry } from "../repository/repository-registry.js";

interface CreateAppShellHandlersOptions {
  readonly isPackaged: boolean;
  readonly gitExecutableResolver: GitExecutableResolver;
  readonly repositoryRegistry: RepositoryRegistry;
  readonly pickRepositoryPath: () => Promise<string | null>;
}

export interface AppShellHandlers {
  getBootstrap(): Promise<AppShellBootstrap>;
  getGitStatus(): Promise<GitStatus>;
  openRepository(payload: unknown): Promise<OpenRepositoryResult>;
  pickAndOpenRepository(): Promise<OpenRepositoryResult>;
}

export function createAppShellHandlers(options: CreateAppShellHandlersOptions): AppShellHandlers {
  const repositoryOpener = new RepositoryOpener(
    options.gitExecutableResolver,
    options.repositoryRegistry
  );

  return {
    async getBootstrap(): Promise<AppShellBootstrap> {
      return validateContract(
        appShellBootstrapSchema,
        createAppShellBootstrap(options.isPackaged),
        "app-shell bootstrap response"
      );
    },

    async getGitStatus(): Promise<GitStatus> {
      return validateContract(
        gitStatusSchema,
        await options.gitExecutableResolver.resolveStatus(),
        "git status response"
      );
    },

    async openRepository(payload: unknown): Promise<OpenRepositoryResult> {
      const parsedRequest = openRepositoryRequestSchema.safeParse(payload);

      if (!parsedRequest.success) {
        return validateContract(
          openRepositoryResultSchema,
          {
            kind: "error",
            error: createInvalidPayloadError("open repository request", parsedRequest.error),
          },
          "open repository error response"
        );
      }

      return validateContract(
        openRepositoryResultSchema,
        await repositoryOpener.openRepository(parsedRequest.data),
        "open repository response"
      );
    },

    async pickAndOpenRepository(): Promise<OpenRepositoryResult> {
      const repositoryPath = await options.pickRepositoryPath();

      if (!repositoryPath) {
        return validateContract(
          openRepositoryResultSchema,
          { kind: "cancelled" },
          "pick repository cancellation response"
        );
      }

      return this.openRepository({ repositoryPath });
    },
  };
}

export function createUnexpectedOpenRepositoryResult(
  summary: string,
  detail: string,
  repositoryPath?: string,
  stderr?: string
): OpenRepositoryResult {
  const error: AppShellError = {
    code: "UNEXPECTED",
    summary,
    detail,
    repositoryPath,
    stderr,
  };

  return validateContract(
    openRepositoryResultSchema,
    { kind: "error", error },
    "unexpected open repository response"
  );
}
