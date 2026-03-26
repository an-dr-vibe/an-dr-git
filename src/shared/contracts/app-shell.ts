export const APP_SHELL_CHANNELS = {
  getBootstrap: "app-shell:get-bootstrap",
} as const;

export type AppShellPlatform = "darwin" | "linux" | "win32";

export type AppShellPanelId = "repository-tree" | "branch-state" | "diff-inspector";

export interface AppShellBootstrap {
  readonly appName: string;
  readonly shellVersion: string;
  readonly platform: AppShellPlatform;
  readonly isPackaged: boolean;
  readonly sessionContainerLabel: string;
}

export interface AppShellPanelDefinition {
  readonly id: AppShellPanelId;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
}

export interface AppShellApi {
  getBootstrap(): Promise<AppShellBootstrap>;
}
