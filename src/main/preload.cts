/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

import type {
  AppShellApi,
  AppShellBootstrap,
  GitStatus,
  OpenRepositoryRequest,
  OpenRepositoryResult,
  RepositorySnapshotState,
} from "../shared/contracts/app-shell.js";
import type {
  RepositoryDiffRequest,
  RepositoryDiffResult,
} from "../shared/contracts/repository-diff.js";

type AppShellContractsModule = typeof import("../shared/contracts/app-shell.js");

let contractsPromise: Promise<AppShellContractsModule> | null = null;

function loadContracts(): Promise<AppShellContractsModule> {
  contractsPromise ??= import("../shared/contracts/app-shell.js");

  return contractsPromise;
}

async function invokeWithoutPayload<TResult>(
  channel: string,
  responseValidator: (value: unknown) => TResult
): Promise<TResult> {
  return responseValidator(await ipcRenderer.invoke(channel));
}

async function invokeWithPayload<TPayload, TResult>(
  channel: string,
  payload: TPayload,
  payloadValidator: (value: unknown) => TPayload,
  responseValidator: (value: unknown) => TResult
): Promise<TResult> {
  const validatedPayload = payloadValidator(payload);
  const response = await ipcRenderer.invoke(channel, validatedPayload);

  return responseValidator(response);
}

const appShellApi: AppShellApi = {
  getBootstrap: async (): Promise<AppShellBootstrap> => {
    const { APP_SHELL_CHANNELS, appShellBootstrapSchema, validateContract } = await loadContracts();

    return invokeWithoutPayload(APP_SHELL_CHANNELS.getBootstrap, (value) =>
      validateContract(appShellBootstrapSchema, value, "app-shell bootstrap response")
    );
  },
  getGitStatus: async (): Promise<GitStatus> => {
    const { APP_SHELL_CHANNELS, gitStatusSchema, validateContract } = await loadContracts();

    return invokeWithoutPayload(APP_SHELL_CHANNELS.getGitStatus, (value) =>
      validateContract(gitStatusSchema, value, "git status response")
    );
  },
  openRepository: async (request: OpenRepositoryRequest): Promise<OpenRepositoryResult> => {
    const {
      APP_SHELL_CHANNELS,
      openRepositoryRequestSchema,
      openRepositoryResultSchema,
      validateContract,
    } = await loadContracts();

    return invokeWithPayload(
      APP_SHELL_CHANNELS.openRepository,
      request,
      (value) => validateContract(openRepositoryRequestSchema, value, "open repository request"),
      (value) => validateContract(openRepositoryResultSchema, value, "open repository response")
    );
  },
  pickAndOpenRepository: async (): Promise<OpenRepositoryResult> => {
    const { APP_SHELL_CHANNELS, openRepositoryResultSchema, validateContract } = await loadContracts();

    return invokeWithoutPayload(APP_SHELL_CHANNELS.pickAndOpenRepository, (value) =>
      validateContract(openRepositoryResultSchema, value, "pick repository response")
    );
  },
  getRepositorySnapshot: async (): Promise<RepositorySnapshotState> => {
    const { APP_SHELL_CHANNELS, repositorySnapshotStateSchema, validateContract } =
      await loadContracts();

    return invokeWithoutPayload(APP_SHELL_CHANNELS.getRepositorySnapshot, (value) =>
      validateContract(repositorySnapshotStateSchema, value, "repository snapshot state response")
    );
  },
  refreshRepositorySnapshot: async (): Promise<RepositorySnapshotState> => {
    const { APP_SHELL_CHANNELS, repositorySnapshotStateSchema, validateContract } =
      await loadContracts();

    return invokeWithoutPayload(APP_SHELL_CHANNELS.refreshRepositorySnapshot, (value) =>
      validateContract(repositorySnapshotStateSchema, value, "repository snapshot refresh response")
    );
  },
  getRepositoryDiff: async (request: RepositoryDiffRequest): Promise<RepositoryDiffResult> => {
    const { APP_SHELL_CHANNELS, validateContract } = await loadContracts();
    const { repositoryDiffRequestSchema, repositoryDiffResultSchema } = await import(
      "../shared/contracts/repository-diff.js"
    );

    return invokeWithPayload(
      APP_SHELL_CHANNELS.getRepositoryDiff,
      request,
      (value) => validateContract(repositoryDiffRequestSchema, value, "repository diff request"),
      (value) => validateContract(repositoryDiffResultSchema, value, "repository diff response")
    );
  },
};

contextBridge.exposeInMainWorld("appShell", appShellApi);
