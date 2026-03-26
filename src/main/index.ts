import { app } from "electron";
import startedBySquirrel from "electron-squirrel-startup";

import { createMainWindow } from "./app/create-main-window.js";
import { registerAppShellHandlers } from "./ipc/register-app-shell-handlers.js";

const isSmokeTest = process.env.AN_DR_GIT_SMOKE_TEST === "1";

if (startedBySquirrel) {
  app.quit();
}

async function bootstrapApplication(): Promise<void> {
  await app.whenReady();

  registerAppShellHandlers();

  const mainWindow = createMainWindow();

  if (isSmokeTest) {
    mainWindow.webContents.once("did-finish-load", () => {
      app.quit();
    });
  }

  mainWindow.once("ready-to-show", () => {
    if (isSmokeTest) {
      return;
    }

    mainWindow.show();
  });

  app.on("activate", () => {
    if (mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

void bootstrapApplication();
