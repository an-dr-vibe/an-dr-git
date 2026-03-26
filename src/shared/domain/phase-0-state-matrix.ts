import type { GitStatus, OpenRepositoryResult } from "../contracts/app-shell.js";

export type Phase0StateId =
  | "app-starting"
  | "git-detecting"
  | "git-missing"
  | "no-repository"
  | "repository-open-in-progress"
  | "repository-opened"
  | "invalid-repository"
  | "unexpected-error";

export interface Phase0StateDefinition {
  readonly id: Phase0StateId;
  readonly title: string;
  readonly description: string;
}

export interface ResolvePhase0StateOptions {
  readonly loadStateKind: "loading" | "ready" | "error";
  readonly gitStatus: GitStatus | undefined;
  readonly activeRepository: boolean;
  readonly isOpeningRepository: boolean;
  readonly lastOpenResult: OpenRepositoryResult | null;
}

export const PHASE_0_STATE_MATRIX: readonly Phase0StateDefinition[] = [
  {
    id: "app-starting",
    title: "App Starting",
    description: "The renderer is waiting for preload bootstrap and the first shell metadata.",
  },
  {
    id: "git-detecting",
    title: "Git Detecting",
    description: "System Git detection is in progress and repository actions stay disabled.",
  },
  {
    id: "git-missing",
    title: "Git Missing",
    description: "System Git is unavailable or unusable and the shell explains the install requirement.",
  },
  {
    id: "no-repository",
    title: "No Repository",
    description: "The shell is healthy, but no repository session has been opened yet.",
  },
  {
    id: "repository-open-in-progress",
    title: "Repository Open In Progress",
    description: "The main process is validating a selected path through Git before activating a session.",
  },
  {
    id: "repository-opened",
    title: "Repository Opened",
    description: "A repository identity is active and the shell is ready for tree, branch, and diff slices.",
  },
  {
    id: "invalid-repository",
    title: "Invalid Repository",
    description: "The selected path failed repository validation and the shell keeps the exact error visible.",
  },
  {
    id: "unexpected-error",
    title: "Unexpected Error",
    description: "An unexpected failure stopped the normal flow and the shell surfaces raw detail for debugging.",
  },
] as const;

export function getPhase0StateMatrix(): Phase0StateDefinition[] {
  return [...PHASE_0_STATE_MATRIX];
}

export function resolvePhase0State(options: ResolvePhase0StateOptions): Phase0StateId {
  if (options.loadStateKind === "loading") {
    return "app-starting";
  }

  if (options.loadStateKind === "error") {
    return "unexpected-error";
  }

  if (options.isOpeningRepository) {
    return "repository-open-in-progress";
  }

  if (options.gitStatus && options.gitStatus.kind !== "ready") {
    return "git-missing";
  }

  if (options.lastOpenResult?.kind === "error") {
    return "invalid-repository";
  }

  if (options.activeRepository) {
    return "repository-opened";
  }

  return "no-repository";
}
