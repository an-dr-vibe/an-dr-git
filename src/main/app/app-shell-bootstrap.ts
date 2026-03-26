import type { AppShellBootstrap, AppShellPlatform } from "../../shared/contracts/app-shell.js";
import {
  APP_SHELL_NAME,
  APP_SHELL_VERSION,
  SESSION_CONTAINER_LABEL,
} from "../../shared/domain/app-shell-layout.js";

function getPlatform(): AppShellPlatform {
  if (process.platform === "darwin" || process.platform === "linux" || process.platform === "win32") {
    return process.platform;
  }

  throw new Error(`Unsupported platform '${process.platform}' for the current app shell.`);
}

export function createAppShellBootstrap(isPackaged: boolean): AppShellBootstrap {
  return {
    appName: APP_SHELL_NAME,
    shellVersion: APP_SHELL_VERSION,
    platform: getPlatform(),
    isPackaged,
    sessionContainerLabel: SESSION_CONTAINER_LABEL,
  };
}

