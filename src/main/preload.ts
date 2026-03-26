import { contextBridge, ipcRenderer } from "electron";

import {
  APP_SHELL_CHANNELS,
  appShellBootstrapSchema,
  gitStatusSchema,
  openRepositoryRequestSchema,
  openRepositoryResultSchema,
  repositorySnapshotStateSchema,
  type AppShellApi,
  type AppShellBootstrap,
  type GitStatus,
  type OpenRepositoryRequest,
  type OpenRepositoryResult,
  type RepositorySnapshotState,
  validateContract,
} from "../shared/contracts/app-shell.js";

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
  getBootstrap: async (): Promise<AppShellBootstrap> =>
    invokeWithoutPayload(APP_SHELL_CHANNELS.getBootstrap, (value) =>
      validateContract(appShellBootstrapSchema, value, "app-shell bootstrap response")
    ),
  getGitStatus: async (): Promise<GitStatus> =>
    invokeWithoutPayload(APP_SHELL_CHANNELS.getGitStatus, (value) =>
      validateContract(gitStatusSchema, value, "git status response")
    ),
  openRepository: async (request: OpenRepositoryRequest): Promise<OpenRepositoryResult> =>
    invokeWithPayload(
      APP_SHELL_CHANNELS.openRepository,
      request,
      (value) => validateContract(openRepositoryRequestSchema, value, "open repository request"),
      (value) => validateContract(openRepositoryResultSchema, value, "open repository response")
    ),
  pickAndOpenRepository: async (): Promise<OpenRepositoryResult> =>
    invokeWithoutPayload(APP_SHELL_CHANNELS.pickAndOpenRepository, (value) =>
      validateContract(openRepositoryResultSchema, value, "pick repository response")
    ),
  getRepositorySnapshot: async (): Promise<RepositorySnapshotState> =>
    invokeWithoutPayload(APP_SHELL_CHANNELS.getRepositorySnapshot, (value) =>
      validateContract(repositorySnapshotStateSchema, value, "repository snapshot state response")
    ),
  refreshRepositorySnapshot: async (): Promise<RepositorySnapshotState> =>
    invokeWithoutPayload(APP_SHELL_CHANNELS.refreshRepositorySnapshot, (value) =>
      validateContract(repositorySnapshotStateSchema, value, "repository snapshot refresh response")
    ),
};

contextBridge.exposeInMainWorld("appShell", appShellApi);
