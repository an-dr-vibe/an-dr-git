import { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";

function getPreloadPath(): string {
  return fileURLToPath(new URL("../preload.cjs", import.meta.url));
}

function getRendererIndexPath(): string {
  return fileURLToPath(new URL("../../../renderer/index.html", import.meta.url));
}

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: "#e9e4da",
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void mainWindow.loadFile(getRendererIndexPath());

  return mainWindow;
}
