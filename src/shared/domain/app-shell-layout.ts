import type { AppShellPanelDefinition } from "../contracts/app-shell.js";

export const APP_SHELL_NAME = "an-dr-git";
export const APP_SHELL_VERSION = "phase-1-complete";
export const SESSION_CONTAINER_LABEL = "Repository Sessions";

export const APP_SHELL_PANELS: readonly AppShellPanelDefinition[] = [
  {
    id: "repository-tree",
    title: "Repository Tree",
    eyebrow: "Workspace",
    description: "Phase 1 now renders the Git-backed repository tree with tracked, changed, untracked, and ignored states.",
  },
  {
    id: "branch-state",
    title: "Branch State",
    eyebrow: "Branches",
    description: "Phase 1 now shows local and remote branches with current-branch and upstream tracking context.",
  },
  {
    id: "diff-inspector",
    title: "Diff Inspector",
    eyebrow: "Diff",
    description: "Diff rendering stays deferred to Phase 2, but the shell now carries the selected tree and branch context into that next slice.",
  },
] as const;

export function getAppShellPanels(): AppShellPanelDefinition[] {
  return [...APP_SHELL_PANELS];
}
