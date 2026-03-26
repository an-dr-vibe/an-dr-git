import type { AppShellApi } from "../shared/contracts/app-shell.js";

declare global {
  interface Window {
    appShell?: AppShellApi;
    __AN_DR_GIT_RENDERER_STATE__?: "loading" | "ready" | "error";
  }
}

export {};
