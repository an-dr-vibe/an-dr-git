import { contextBridge, ipcRenderer } from "electron";

import { APP_SHELL_CHANNELS, type AppShellApi, type AppShellBootstrap } from "../shared/contracts/app-shell.js";

const appShellApi: AppShellApi = {
  getBootstrap: async () =>
    ipcRenderer.invoke(APP_SHELL_CHANNELS.getBootstrap) as Promise<AppShellBootstrap>,
};

contextBridge.exposeInMainWorld("appShell", appShellApi);
