import { app, ipcMain } from "electron";

import { APP_SHELL_CHANNELS } from "../../shared/contracts/app-shell.js";
import { createAppShellBootstrap } from "../app/app-shell-bootstrap.js";

export function registerAppShellHandlers(): void {
  ipcMain.handle(APP_SHELL_CHANNELS.getBootstrap, () => createAppShellBootstrap(app.isPackaged));
}

