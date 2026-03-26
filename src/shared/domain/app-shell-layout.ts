import type { AppShellPanelDefinition } from "../contracts/app-shell.js";

export const APP_SHELL_NAME = "an-dr-git";
export const APP_SHELL_VERSION = "phase-0-slice-0.2";
export const SESSION_CONTAINER_LABEL = "Repository Sessions";

export const APP_SHELL_PANELS: readonly AppShellPanelDefinition[] = [
  {
    id: "repository-tree",
    title: "Repository Tree",
    eyebrow: "Workspace",
    description: "Tracked and untracked files will render here once repository sessions exist.",
  },
  {
    id: "branch-state",
    title: "Branch State",
    eyebrow: "Branches",
    description: "Local and remote branch context, ahead/behind, and repository state will land here.",
  },
  {
    id: "diff-inspector",
    title: "Diff Inspector",
    eyebrow: "Diff",
    description: "Native git diff output will be rendered here with raw fallback in later slices.",
  },
] as const;

export function getAppShellPanels(): AppShellPanelDefinition[] {
  return [...APP_SHELL_PANELS];
}

