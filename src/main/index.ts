import { app } from "electron";
import startedBySquirrel from "electron-squirrel-startup";

import { createMainWindow } from "./app/create-main-window.js";
import { registerAppShellHandlers } from "./ipc/register-app-shell-handlers.js";

const isSmokeTest = process.env.AN_DR_GIT_SMOKE_TEST === "1";

if (startedBySquirrel) {
  app.quit();
}

const SMOKE_RENDERER_TIMEOUT_MS = 10_000;

async function waitForRendererShell(mainWindow: Electron.BrowserWindow): Promise<void> {
  const deadline = Date.now() + SMOKE_RENDERER_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const state = (await mainWindow.webContents.executeJavaScript(
      `(() => ({
        rendererState: window.__AN_DR_GIT_RENDERER_STATE__ ?? null,
        bodyTextLength: document.body?.innerText?.trim().length ?? 0
      }))()`,
      true
    )) as { rendererState: string | null; bodyTextLength: number };

    if (state.rendererState === "ready" && state.bodyTextLength > 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error("Renderer shell did not become visible before the smoke timeout elapsed.");
}

async function bootstrapApplication(): Promise<void> {
  await app.whenReady();

  registerAppShellHandlers();

  const mainWindow = createMainWindow();

  if (isSmokeTest) {
    mainWindow.webContents.once("did-finish-load", () => {
      void waitForRendererShell(mainWindow)
        .then(() => {
          app.quit();
        })
        .catch((error: unknown) => {
          console.error(
            error instanceof Error ? error.message : "Renderer smoke verification failed."
          );
          app.exit(1);
        });
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
