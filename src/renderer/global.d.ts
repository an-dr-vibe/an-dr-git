import type { AppShellApi } from "../shared/contracts/app-shell.js";

declare global {
  interface Window {
    appShell: AppShellApi;
  }
}

export {};
