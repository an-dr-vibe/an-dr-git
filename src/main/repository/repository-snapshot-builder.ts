import type {
  AppShellError,
  BranchSummary,
  BranchTrackingStatus,
  FileChangeKind,
  RepositoryHeadState,
  RepositoryIdentity,
  RepositorySnapshot,
  TreeNode,
} from "../../shared/contracts/app-shell.js";
import { validateContract, repositorySnapshotSchema } from "../../shared/contracts/app-shell.js";
import { executeGitCommand } from "../git/execute-git-command.js";
import { GitExecutableResolver } from "../git/git-executable-resolver.js";

interface SnapshotBuildError {
  readonly error: AppShellError;
}

interface SnapshotBuildSuccess {
  readonly snapshot: RepositorySnapshot;
}

export type RepositorySnapshotBuildResult = SnapshotBuildSuccess | SnapshotBuildError;

interface ParsedStatusEntry {
  readonly path: string;
  readonly change: FileChangeKind;
  readonly previousPath?: string;
}

interface ParsedStatusHeaders {
  branchName: string | null;
  isDetached: boolean;
  isUnborn: boolean;
  upstreamName?: string;
  aheadCount: number;
  behindCount: number;
  commitSha?: string;
}

export interface ParsedStatusPorcelain {
  readonly headers: ParsedStatusHeaders;
  readonly entries: Map<string, ParsedStatusEntry>;
}

const STATUS_HEADER_PREFIX = "# ";
const FIELD_SEPARATOR = "\u001f";
const RECORD_SEPARATOR = "\u001e";
const DIRECTORY_CHANGE_PRIORITY: Record<FileChangeKind, number> = {
  deleted: 60,
  modified: 50,
  renamed: 45,
  added: 40,
  untracked: 30,
  ignored: 10,
  clean: 0,
};

interface TreeSeed {
  readonly path: string;
  readonly change: FileChangeKind;
  readonly previousPath?: string;
}

interface MutableTreeNode {
  readonly path: string;
  readonly name: string;
  readonly kind: "directory" | "file";
  change: FileChangeKind;
  previousPath?: string;
  children: MutableTreeNode[];
}

interface TrackingDetails {
  readonly trackingStatus: BranchTrackingStatus;
  readonly aheadCount: number;
  readonly behindCount: number;
}

interface RefRecord {
  readonly refName: string;
  readonly shortName: string;
  readonly commitSha?: string;
  readonly headMarker: string;
  readonly upstreamName?: string;
  readonly tracking: TrackingDetails;
}

export async function buildRepositorySnapshot(
  repository: RepositoryIdentity,
  gitExecutableResolver: GitExecutableResolver
): Promise<RepositorySnapshotBuildResult> {
  const resolvedGit = await gitExecutableResolver.getResolvedExecutable();

  if ("code" in resolvedGit) {
    return { error: resolvedGit };
  }

  const command = gitExecutableResolver.getCommandName();
  const env = gitExecutableResolver.getCommandEnv();
  const cwd = repository.rootPath;

  const [statusResult, trackedResult, untrackedResult, ignoredResult, refsResult] = await Promise.all([
    executeGitCommand(command, ["status", "--porcelain=v2", "--branch", "-z"], {
      cwd,
      env,
      timeoutMs: 10_000,
      operationKind: "read",
      operationName: "snapshot:status",
      repositoryPath: cwd,
    }),
    executeGitCommand(command, ["ls-files", "-z"], {
      cwd,
      env,
      timeoutMs: 10_000,
      operationKind: "read",
      operationName: "snapshot:tracked-files",
      repositoryPath: cwd,
    }),
    executeGitCommand(command, ["ls-files", "--others", "--exclude-standard", "-z"], {
      cwd,
      env,
      timeoutMs: 10_000,
      operationKind: "read",
      operationName: "snapshot:untracked-files",
      repositoryPath: cwd,
    }),
    executeGitCommand(command, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"], {
      cwd,
      env,
      timeoutMs: 10_000,
      operationKind: "read",
      operationName: "snapshot:ignored-files",
      repositoryPath: cwd,
    }),
    executeGitCommand(
      command,
      [
        "for-each-ref",
        `--format=%(refname)%x1f%(refname:short)%x1f%(objectname:short)%x1f%(HEAD)%x1f%(upstream:short)%x1f%(upstream:track,nobracket)%x1e`,
        "refs/heads",
        "refs/remotes",
      ],
      {
        cwd,
        env,
        timeoutMs: 10_000,
        operationKind: "read",
        operationName: "snapshot:refs",
        repositoryPath: cwd,
      }
    ),
  ]);

  const commandFailure = [
    { label: "repository status", result: statusResult },
    { label: "tracked files", result: trackedResult },
    { label: "untracked files", result: untrackedResult },
    { label: "ignored files", result: ignoredResult },
    { label: "branch refs", result: refsResult },
  ].find(({ result }) => result.exitCode !== 0 || result.spawnError || result.timedOut);

  if (commandFailure) {
    return {
      error: {
        code: "UNEXPECTED",
        summary: `Git could not build the ${commandFailure.label} snapshot.`,
        detail: "The repository opened successfully, but Git did not complete one of the Phase 1 read commands.",
        repositoryPath: cwd,
        stderr:
          commandFailure.result.stderr.trim() ||
          commandFailure.result.stdout.trim() ||
          commandFailure.result.spawnError?.message ||
          undefined,
      },
    };
  }

  const status = parseStatusPorcelainV2(statusResult.stdout);
  const trackedPaths = parseNullSeparatedPaths(trackedResult.stdout);
  const untrackedPaths = parseNullSeparatedPaths(untrackedResult.stdout);
  const ignoredPaths = parseNullSeparatedPaths(ignoredResult.stdout);
  const tree = buildTreeNodes(trackedPaths, untrackedPaths, ignoredPaths, status.entries);
  const branches = buildBranchSummaries(repository, status.headers, refsResult.stdout);
  const snapshot = validateContract(
    repositorySnapshotSchema,
    {
      head: buildHeadState(repository, status.headers),
      branches,
      tree,
      counts: {
        trackedFiles: trackedPaths.length,
        changedFiles: [...status.entries.values()].filter((entry) => entry.change !== "clean").length,
        untrackedFiles: untrackedPaths.length,
        ignoredFiles: ignoredPaths.length,
      },
    },
    "repository snapshot"
  );

  return { snapshot };
}

export function parseStatusPorcelainV2(output: string): ParsedStatusPorcelain {
  const entries = new Map<string, ParsedStatusEntry>();
  let index = 0;
  const headers: ParsedStatusHeaders = {
    branchName: null,
    isDetached: false,
    isUnborn: false,
    aheadCount: 0,
    behindCount: 0,
  };

  while (output.startsWith(STATUS_HEADER_PREFIX, index)) {
    const lineEnd = output.indexOf("\n", index);

    if (lineEnd === -1) {
      break;
    }

    const headerLine = output.slice(index + STATUS_HEADER_PREFIX.length, lineEnd).trim();
    index = lineEnd + 1;

    if (headerLine.startsWith("branch.head ")) {
      const branchHead = headerLine.slice("branch.head ".length);

      if (branchHead === "(detached)") {
        headers.isDetached = true;
        headers.branchName = null;
      } else if (branchHead === "(initial)") {
        headers.isUnborn = true;
      } else {
        headers.branchName = branchHead;
      }
    }

    if (headerLine.startsWith("branch.oid ")) {
      const commitSha = headerLine.slice("branch.oid ".length);

      if (commitSha === "(initial)") {
        headers.isUnborn = true;
      } else {
        headers.commitSha = commitSha;
      }
    }

    if (headerLine.startsWith("branch.upstream ")) {
      headers.upstreamName = headerLine.slice("branch.upstream ".length);
    }

    if (headerLine.startsWith("branch.ab ")) {
      const match = /^branch\.ab \+(?<ahead>\d+) -(?<behind>\d+)$/u.exec(headerLine);

      if (match?.groups) {
        const ahead = match.groups.ahead;
        const behind = match.groups.behind;

        if (ahead) {
          headers.aheadCount = Number.parseInt(ahead, 10);
        }

        if (behind) {
          headers.behindCount = Number.parseInt(behind, 10);
        }
      }
    }
  }

  const recordTokens = output.slice(index).split("\0").filter((token) => token.length > 0);

  for (let tokenIndex = 0; tokenIndex < recordTokens.length; tokenIndex += 1) {
    const token = recordTokens[tokenIndex];

    if (!token) {
      continue;
    }

    if (token.startsWith("1 ")) {
      const match =
        /^1 (?<xy>\S{2}) \S+ \S+ \S+ \S+ \S+ \S+ (?<path>.+)$/us.exec(token);

      if (!match?.groups) {
        continue;
      }

      const path = match.groups.path;
      const xy = match.groups.xy;

      if (!path || !xy) {
        continue;
      }

      entries.set(path, {
        path,
        change: resolveFileChange("1", xy),
      });
      continue;
    }

    if (token.startsWith("2 ")) {
      const match =
        /^2 (?<xy>\S{2}) \S+ \S+ \S+ \S+ \S+ \S+ \S+ (?<path>.+)$/us.exec(token);
      const previousPath = recordTokens[tokenIndex + 1];

      if (!match?.groups || !previousPath) {
        continue;
      }

      const path = match.groups.path;

      if (!path) {
        continue;
      }

      tokenIndex += 1;
      entries.set(path, {
        path,
        change: "renamed",
        previousPath,
      });
      continue;
    }

    if (token.startsWith("? ")) {
      const path = token.slice(2);
      entries.set(path, { path, change: "untracked" });
      continue;
    }

    if (token.startsWith("! ")) {
      const path = token.slice(2);
      entries.set(path, { path, change: "ignored" });
    }
  }

  return { headers, entries };
}

export function parseNullSeparatedPaths(output: string): string[] {
  return output.split("\0").filter((path) => path.length > 0);
}

export function buildTreeNodes(
  trackedPaths: readonly string[],
  untrackedPaths: readonly string[],
  ignoredPaths: readonly string[],
  statusEntries: ReadonlyMap<string, ParsedStatusEntry>
): TreeNode[] {
  const fileSeeds = new Map<string, TreeSeed>();

  for (const path of trackedPaths) {
    fileSeeds.set(path, { path, change: "clean" });
  }

  for (const path of untrackedPaths) {
    fileSeeds.set(path, { path, change: "untracked" });
  }

  for (const path of ignoredPaths) {
    fileSeeds.set(path, { path, change: "ignored" });
  }

  for (const entry of statusEntries.values()) {
    const seed: TreeSeed = entry.previousPath
      ? {
          path: entry.path,
          change: entry.change,
          previousPath: entry.previousPath,
        }
      : {
          path: entry.path,
          change: entry.change,
        };

    fileSeeds.set(entry.path, seed);

    if (entry.previousPath && !statusEntries.has(entry.previousPath)) {
      fileSeeds.delete(entry.previousPath);
    }
  }

  const roots: MutableTreeNode[] = [];
  const directories = new Map<string, MutableTreeNode>();

  for (const seed of [...fileSeeds.values()].sort((left, right) => left.path.localeCompare(right.path))) {
    const segments = seed.path.split("/").filter((segment) => segment.length > 0);
    let currentChildren = roots;
    let accumulatedPath = "";

    for (let segmentIndex = 0; segmentIndex < segments.length - 1; segmentIndex += 1) {
      const segment = segments[segmentIndex];

      if (!segment) {
        continue;
      }

      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;
      const existingDirectory = directories.get(accumulatedPath);

      if (existingDirectory) {
        currentChildren = existingDirectory.children;
        continue;
      }

      const directoryNode: MutableTreeNode = {
        path: accumulatedPath,
        name: segment,
        kind: "directory",
        change: "clean",
        children: [],
      };

      currentChildren.push(directoryNode);
      directories.set(accumulatedPath, directoryNode);
      currentChildren = directoryNode.children;
    }

    const fileNode: MutableTreeNode = {
      path: seed.path,
      name: segments.at(-1) ?? seed.path,
      kind: "file",
      change: seed.change,
      children: [],
      ...(seed.previousPath ? { previousPath: seed.previousPath } : {}),
    };

    currentChildren.push(fileNode);
  }

  return sortAndFinalizeTree(roots);
}

export function buildBranchSummaries(
  repository: RepositoryIdentity,
  statusHeaders: ParsedStatusHeaders,
  refsOutput: string
): { local: BranchSummary[]; remote: BranchSummary[] } {
  const localBranches: BranchSummary[] = [];
  const remoteBranches: BranchSummary[] = [];
  const refRecords = parseRefRecords(refsOutput);
  let hasCurrentLocalBranch = false;

  for (const record of refRecords) {
    if (record.refName.endsWith("/HEAD")) {
      continue;
    }

    const isLocal = record.refName.startsWith("refs/heads/");
    const branch: BranchSummary = {
      refName: record.refName,
      name: record.shortName,
      kind: isLocal ? "local" : "remote",
      isCurrent:
        isLocal &&
        !repository.isDetached &&
        !repository.isUnborn &&
        (record.headMarker === "*" || record.shortName === repository.currentHead),
      trackingStatus: isLocal ? record.tracking.trackingStatus : "missing",
      aheadCount: isLocal ? record.tracking.aheadCount : 0,
      behindCount: isLocal ? record.tracking.behindCount : 0,
      ...(!isLocal ? { remoteName: record.shortName.split("/", 1)[0] } : {}),
      ...(record.commitSha ? { commitSha: record.commitSha } : {}),
      ...(isLocal && record.upstreamName ? { upstreamName: record.upstreamName } : {}),
    };

    if (branch.isCurrent) {
      hasCurrentLocalBranch = true;
    }

    if (isLocal) {
      localBranches.push(branch);
    } else {
      remoteBranches.push(branch);
    }
  }

  if (!repository.isDetached && repository.currentHead.length > 0 && !hasCurrentLocalBranch) {
    localBranches.unshift({
      refName: `refs/heads/${repository.currentHead}`,
      name: repository.currentHead,
      kind: "local",
      isCurrent: true,
      trackingStatus: statusHeaders.upstreamName ? "tracking" : "missing",
      aheadCount: statusHeaders.aheadCount,
      behindCount: statusHeaders.behindCount,
      ...(statusHeaders.commitSha ? { commitSha: statusHeaders.commitSha } : {}),
      ...(statusHeaders.upstreamName ? { upstreamName: statusHeaders.upstreamName } : {}),
    });
  }

  return {
    local: sortBranches(localBranches),
    remote: sortBranches(remoteBranches),
  };
}

function buildHeadState(
  repository: RepositoryIdentity,
  statusHeaders: ParsedStatusHeaders
): RepositoryHeadState {
  const isDetached = statusHeaders.isDetached || repository.isDetached;
  const isUnborn = statusHeaders.isUnborn || repository.isUnborn;
  const label = statusHeaders.branchName ?? statusHeaders.commitSha?.slice(0, 7) ?? repository.currentHead;

  return {
    kind: isDetached ? "detached" : "branch",
    label,
    isUnborn,
    aheadCount: statusHeaders.aheadCount,
    behindCount: statusHeaders.behindCount,
    ...(statusHeaders.commitSha ? { commitSha: statusHeaders.commitSha } : {}),
    ...(statusHeaders.upstreamName ? { upstreamName: statusHeaders.upstreamName } : {}),
  };
}

function resolveFileChange(recordType: "1" | "2", xy: string): FileChangeKind {
  if (recordType === "2" || xy.includes("R") || xy.includes("C")) {
    return "renamed";
  }

  if (xy.includes("D")) {
    return "deleted";
  }

  if (xy.includes("A")) {
    return "added";
  }

  if (/[MTU]/u.test(xy)) {
    return "modified";
  }

  return "clean";
}

function sortAndFinalizeTree(nodes: readonly MutableTreeNode[]): TreeNode[] {
  const sortedNodes = [...nodes].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  return sortedNodes.map((node) => {
    const children = sortAndFinalizeTree(node.children);
    const change =
      node.kind === "directory" ? summarizeDirectoryChange(children.map((child) => child.change)) : node.change;

    return {
      path: node.path,
      name: node.name,
      kind: node.kind,
      change,
      children,
      ...(node.previousPath ? { previousPath: node.previousPath } : {}),
    };
  });
}

function summarizeDirectoryChange(changes: readonly FileChangeKind[]): FileChangeKind {
  return changes.reduce<FileChangeKind>((current, next) => {
    return DIRECTORY_CHANGE_PRIORITY[next] > DIRECTORY_CHANGE_PRIORITY[current] ? next : current;
  }, "clean");
}

function parseRefRecords(output: string): RefRecord[] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [refName = "", shortName = "", commitSha = "", headMarker = "", upstreamName = "", trackingValue = ""] =
        record.split(FIELD_SEPARATOR);

      const refRecord: RefRecord = {
        refName,
        shortName,
        headMarker,
        tracking: parseTrackingDetails(trackingValue),
        ...(commitSha ? { commitSha } : {}),
        ...(upstreamName ? { upstreamName } : {}),
      };

      return refRecord;
    })
    .filter((record) => record.refName.length > 0 && record.shortName.length > 0);
}

function parseTrackingDetails(value: string): TrackingDetails {
  if (!value) {
    return {
      trackingStatus: "missing",
      aheadCount: 0,
      behindCount: 0,
    };
  }

  if (value === "gone") {
    return {
      trackingStatus: "gone",
      aheadCount: 0,
      behindCount: 0,
    };
  }

  return {
    trackingStatus: "tracking",
    aheadCount: parseTrackedCount(value, "ahead"),
    behindCount: parseTrackedCount(value, "behind"),
  };
}

function parseTrackedCount(value: string, direction: "ahead" | "behind"): number {
  const match = new RegExp(`${direction} (?<count>\\d+)`, "u").exec(value);
  return match?.groups?.count ? Number.parseInt(match.groups.count, 10) : 0;
}

function sortBranches(branches: readonly BranchSummary[]): BranchSummary[] {
  return [...branches].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}
