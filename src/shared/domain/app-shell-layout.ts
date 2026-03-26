import type { AppShellPanelDefinition } from "../contracts/app-shell.js";

export const APP_SHELL_NAME = "an-dr-git";
export const APP_SHELL_VERSION = "phase-0-complete";
export const SESSION_CONTAINER_LABEL = "Repository Sessions";

export const APP_SHELL_PANELS: readonly AppShellPanelDefinition[] = [
  {
    id: "repository-tree",
    title: "Repository Tree",
    eyebrow: "Workspace",
    description: "Repository identity is live. Tree rendering lands next once snapshot building is in place.",
  },
  {
    id: "branch-state",
    title: "Branch State",
    eyebrow: "Branches",
    description: "The active HEAD now comes from Git. Full branch lists and tracking details land in the next phase.",
  },
  {
    id: "diff-inspector",
    title: "Diff Inspector",
    eyebrow: "Diff",
    description: "Diff rendering stays deferred, but repository open failures already preserve raw Git stderr for debugging.",
  },
] as const;

export function getAppShellPanels(): AppShellPanelDefinition[] {
  return [...APP_SHELL_PANELS];
}
