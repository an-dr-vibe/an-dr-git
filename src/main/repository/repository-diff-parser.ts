import type {
  DiffFile,
  DiffFileChangeType,
  DiffHunk,
  DiffLine,
  DiffMarker,
  RepositoryDiffDocument,
} from "../../shared/contracts/repository-diff.js";
import { repositoryDiffDocumentSchema } from "../../shared/contracts/repository-diff.js";
import { validateContract } from "../../shared/contracts/app-shell.js";

const DIFF_HEADER_PREFIX = "diff --git ";
const BINARY_DIFF_PREFIX = "Binary files ";
const GIT_BINARY_PATCH_LINE = "GIT binary patch";
const NO_NEWLINE_MARKER = "\\ No newline at end of file";

interface ParseResult {
  readonly files: DiffFile[];
  readonly warnings: string[];
  readonly sawBinary: boolean;
}

export function parseRepositoryDiffDocument(
  requestedPath: string,
  rawText: string
): RepositoryDiffDocument {
  if (rawText.length === 0) {
    return validateContract(
      repositoryDiffDocumentSchema,
      {
        requestedPath,
        parseState: "empty",
        rawText,
        files: [],
        warnings: [],
      },
      "repository diff document"
    );
  }

  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const { files, warnings, sawBinary } = parseDiffFiles(normalizedText);
  const parseState =
    files.length === 0
      ? "raw"
      : warnings.length > 0
        ? "partial"
        : sawBinary && files.every((file) => file.markers.includes("binary")) && files.every((file) => file.hunks.length === 0)
          ? "binary"
          : "parsed";

  return validateContract(
    repositoryDiffDocumentSchema,
    {
      requestedPath,
      parseState,
      rawText,
      files,
      warnings,
    },
    "repository diff document"
  );
}

function parseDiffFiles(normalizedText: string): ParseResult {
  const lines = normalizedText.split("\n");
  const files: DiffFile[] = [];
  const warnings: string[] = [];
  let sawBinary = false;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line) {
      index += 1;
      continue;
    }

    if (!line.startsWith(DIFF_HEADER_PREFIX)) {
      warnings.push(`Unsupported diff content outside a file header: ${line}`);
      index += 1;
      continue;
    }

    const parsed = parseDiffFile(lines, index);
    files.push(parsed.file);
    warnings.push(...parsed.warnings);
    sawBinary ||= parsed.file.markers.includes("binary");
    index = parsed.nextIndex;
  }

  return { files, warnings, sawBinary };
}

function parseDiffFile(
  lines: readonly string[],
  startIndex: number
): { file: DiffFile; warnings: string[]; nextIndex: number } {
  const headerLine = lines[startIndex] ?? "";
  const match = /^diff --git a\/(?<oldPath>.+) b\/(?<newPath>.+)$/u.exec(headerLine);
  const oldPath = match?.groups?.oldPath ?? "unknown";
  const newPath = match?.groups?.newPath ?? oldPath;
  const headerLines = [headerLine];
  const markers = new Set<DiffMarker>();
  const warnings: string[] = [];
  const hunks: DiffHunk[] = [];
  let changeType: DiffFileChangeType = "modified";
  let currentOldPath = oldPath;
  let currentNewPath = newPath;
  let index = startIndex + 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line && index === lines.length - 1) {
      index += 1;
      continue;
    }

    if (line.startsWith(DIFF_HEADER_PREFIX)) {
      break;
    }

    if (line.startsWith("@@ ")) {
      const parsedHunk = parseHunk(lines, index);
      hunks.push(parsedHunk.hunk);
      for (const marker of parsedHunk.markers) {
        markers.add(marker);
      }

      warnings.push(...parsedHunk.warnings);
      index = parsedHunk.nextIndex;
      continue;
    }

    if (!line) {
      headerLines.push(line);
      index += 1;
      continue;
    }

    headerLines.push(line);

    if (line.startsWith("rename from ")) {
      markers.add("rename");
      currentOldPath = line.slice("rename from ".length);
      changeType = "renamed";
      index += 1;
      continue;
    }

    if (line.startsWith("rename to ")) {
      markers.add("rename");
      currentNewPath = line.slice("rename to ".length);
      changeType = "renamed";
      index += 1;
      continue;
    }

    if (line.startsWith("copy from ")) {
      markers.add("copy");
      currentOldPath = line.slice("copy from ".length);
      changeType = "copied";
      index += 1;
      continue;
    }

    if (line.startsWith("copy to ")) {
      markers.add("copy");
      currentNewPath = line.slice("copy to ".length);
      changeType = "copied";
      index += 1;
      continue;
    }

    if (
      line.startsWith("old mode ") ||
      line.startsWith("new mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("new file mode ")
    ) {
      markers.add("mode-change");

      if (line.startsWith("deleted file mode ")) {
        markers.add("deleted-file");
        changeType = "deleted";
      } else if (line.startsWith("new file mode ")) {
        markers.add("new-file");
        changeType = "added";
      } else if (changeType === "modified") {
        changeType = "mode-changed";
      }

      index += 1;
      continue;
    }

    if (line.startsWith("--- ")) {
      currentOldPath = normalizePatchPath(line.slice(4), currentOldPath);
      index += 1;
      continue;
    }

    if (line.startsWith("+++ ")) {
      currentNewPath = normalizePatchPath(line.slice(4), currentNewPath);
      index += 1;
      continue;
    }

    if (line.startsWith(BINARY_DIFF_PREFIX) || line === GIT_BINARY_PATCH_LINE) {
      markers.add("binary");
      index += 1;

      while (index < lines.length) {
        const binaryLine = lines[index] ?? "";

        if (binaryLine.startsWith(DIFF_HEADER_PREFIX)) {
          break;
        }

        if (binaryLine && binaryLine.startsWith("@@ ")) {
          warnings.push("Encountered both binary and text hunk content in the same diff file.");
          break;
        }

        if (binaryLine) {
          headerLines.push(binaryLine);
        }

        index += 1;
      }

      continue;
    }

    if (
      line.startsWith("index ") ||
      line.startsWith("similarity index ") ||
      line.startsWith("dissimilarity index ")
    ) {
      index += 1;
      continue;
    }

    warnings.push(`Unsupported diff header line: ${line}`);
    index += 1;
  }

  if (markers.has("rename")) {
    changeType = "renamed";
  }

  if (markers.has("copy")) {
    changeType = "copied";
  }

  return {
    file: {
      oldPath: currentOldPath,
      newPath: currentNewPath,
      displayPath: currentNewPath !== "/dev/null" ? currentNewPath : currentOldPath,
      changeType,
      markers: [...markers],
      headerLines,
      hunks,
    },
    warnings,
    nextIndex: index,
  };
}

function parseHunk(
  lines: readonly string[],
  startIndex: number
): { hunk: DiffHunk; markers: DiffMarker[]; warnings: string[]; nextIndex: number } {
  const header = lines[startIndex] ?? "";
  const match = /^@@ -(?<oldStart>\d+)(?:,(?<oldLines>\d+))? \+(?<newStart>\d+)(?:,(?<newLines>\d+))? @@/u.exec(
    header
  );
  const warnings: string[] = [];
  const markers = new Set<DiffMarker>();
  const parsedOldStart = Number.parseInt(match?.groups?.oldStart ?? "1", 10);
  const parsedOldLines = Number.parseInt(match?.groups?.oldLines ?? "1", 10);
  const parsedNewStart = Number.parseInt(match?.groups?.newStart ?? "1", 10);
  const parsedNewLines = Number.parseInt(match?.groups?.newLines ?? "1", 10);
  const hunkLines: DiffLine[] = [];
  let oldLineNumber = parsedOldStart;
  let newLineNumber = parsedNewStart;
  let index = startIndex + 1;

  if (!match) {
    warnings.push(`Unsupported hunk header: ${header}`);
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.startsWith(DIFF_HEADER_PREFIX) || line.startsWith("@@ ")) {
      break;
    }

    if (!line && index === lines.length - 1) {
      index += 1;
      break;
    }

    if (line.startsWith(" ")) {
      hunkLines.push({
        kind: "context",
        text: line.slice(1),
        oldLineNumber,
        newLineNumber,
      });
      oldLineNumber += 1;
      newLineNumber += 1;
      index += 1;
      continue;
    }

    if (line.startsWith("+")) {
      hunkLines.push({
        kind: "addition",
        text: line.slice(1),
        oldLineNumber: null,
        newLineNumber,
      });
      newLineNumber += 1;
      index += 1;
      continue;
    }

    if (line.startsWith("-")) {
      hunkLines.push({
        kind: "deletion",
        text: line.slice(1),
        oldLineNumber,
        newLineNumber: null,
      });
      oldLineNumber += 1;
      index += 1;
      continue;
    }

    if (line === NO_NEWLINE_MARKER) {
      markers.add("no-newline");
      hunkLines.push({
        kind: "meta",
        text: line,
        oldLineNumber: null,
        newLineNumber: null,
      });
      index += 1;
      continue;
    }

    if (!line) {
      warnings.push("Encountered an unexpected blank line inside a hunk.");
      index += 1;
      continue;
    }

    warnings.push(`Unsupported hunk line: ${line}`);
    hunkLines.push({
      kind: "meta",
      text: line,
      oldLineNumber: null,
      newLineNumber: null,
    });
    index += 1;
  }

  return {
    hunk: {
      header,
      oldStart: parsedOldStart,
      oldLines: parsedOldLines,
      newStart: parsedNewStart,
      newLines: parsedNewLines,
      lines: hunkLines,
    },
    markers: [...markers],
    warnings,
    nextIndex: index,
  };
}

function normalizePatchPath(rawPath: string, fallbackPath: string): string {
  if (rawPath === "/dev/null") {
    return rawPath;
  }

  if (rawPath.startsWith("a/") || rawPath.startsWith("b/")) {
    return rawPath.slice(2);
  }

  return rawPath || fallbackPath;
}
