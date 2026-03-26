import type { RepositorySnapshotState } from "../contracts/app-shell.js";

export interface Phase1StateDefinition {
  readonly id: Phase1StateId;
  readonly title: string;
  readonly description: string;
}

export type Phase1StateId = "empty" | "loading" | "ready" | "refreshing" | "stale" | "error";

const PHASE_1_STATE_MATRIX: readonly Phase1StateDefinition[] = [
  {
    id: "empty",
    title: "No Repository Snapshot",
    description: "The shell is ready, but no repository snapshot exists yet because no repository is open.",
  },
  {
    id: "loading",
    title: "Initial Snapshot Loading",
    description:
      "The renderer has an active repository session and is waiting for the first Git-backed tree and branch snapshot.",
  },
  {
    id: "ready",
    title: "Snapshot Ready",
    description:
      "The current tree and branch model is loaded, readable, and ready for later diff and sync interactions.",
  },
  {
    id: "refreshing",
    title: "Manual Refresh In Progress",
    description:
      "A refresh is running while the last good snapshot stays visible so the UI does not imply repository state vanished.",
  },
  {
    id: "stale",
    title: "Watcher Hint Pending",
    description:
      "Filesystem or Git metadata changes were detected, and the shell is waiting for the next debounced snapshot update.",
  },
  {
    id: "error",
    title: "Snapshot Error",
    description:
      "Snapshot rebuilding failed and the shell keeps the structured error visible without hiding the last known repository context.",
  },
] as const;

export function getPhase1StateMatrix(): Phase1StateDefinition[] {
  return [...PHASE_1_STATE_MATRIX];
}

export function resolvePhase1State(snapshotState: RepositorySnapshotState): Phase1StateId {
  if (!snapshotState.activeRepository) {
    return "empty";
  }

  if (snapshotState.error) {
    return "error";
  }

  if (snapshotState.refreshState === "loading") {
    return "loading";
  }

  if (snapshotState.isStale) {
    return "stale";
  }

  if (snapshotState.refreshState === "refreshing") {
    return "refreshing";
  }

  return "ready";
}
