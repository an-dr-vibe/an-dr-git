import { app, dialog, ipcMain } from "electron";

import { APP_SHELL_CHANNELS } from "../../shared/contracts/app-shell.js";
import { GitExecutableResolver } from "../git/git-executable-resolver.js";
import { createAppShellHandlers } from "./create-app-shell-handlers.js";
import { RepositoryRegistry } from "../repository/repository-registry.js";
import { RepositorySnapshotService } from "../repository/repository-snapshot-service.js";

export function registerAppShellHandlers(): void {
  const gitExecutableResolver = new GitExecutableResolver();
  const repositoryRegistry = new RepositoryRegistry();
  const handlers = createAppShellHandlers({
    isPackaged: app.isPackaged,
    gitExecutableResolver,
    repositoryRegistry,
    repositorySnapshotService: new RepositorySnapshotService(gitExecutableResolver, repositoryRegistry),
    pickRepositoryPath: async () => {
      const result = await dialog.showOpenDialog({
        title: "Open Git Repository",
        buttonLabel: "Open Repository",
        properties: ["openDirectory"],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0] ?? null;
    },
  });

  ipcMain.handle(APP_SHELL_CHANNELS.getBootstrap, () => handlers.getBootstrap());
  ipcMain.handle(APP_SHELL_CHANNELS.getGitStatus, () => handlers.getGitStatus());
  ipcMain.handle(APP_SHELL_CHANNELS.openRepository, (_event, payload: unknown) =>
    handlers.openRepository(payload)
  );
  ipcMain.handle(APP_SHELL_CHANNELS.pickAndOpenRepository, () => handlers.pickAndOpenRepository());
  ipcMain.handle(APP_SHELL_CHANNELS.getRepositorySnapshot, () => handlers.getRepositorySnapshot());
  ipcMain.handle(APP_SHELL_CHANNELS.refreshRepositorySnapshot, () =>
    handlers.refreshRepositorySnapshot()
  );
}
