import { parseRepositoryDiffDocument } from "../../src/main/repository/repository-diff-parser.js";

describe("repository diff parser", () => {
  it("parses a unified diff with line numbers", () => {
    const document = parseRepositoryDiffDocument(
      "src/app.ts",
      [
        "diff --git a/src/app.ts b/src/app.ts",
        "index 1234567..89abcde 100644",
        "--- a/src/app.ts",
        "+++ b/src/app.ts",
        "@@ -1,2 +1,2 @@",
        "-old line",
        "+new line",
        " context line",
      ].join("\n")
    );

    expect(document.parseState).toBe("parsed");
    expect(document.files[0]?.displayPath).toBe("src/app.ts");
    expect(document.files[0]?.hunks[0]?.lines).toMatchObject([
      { kind: "deletion", oldLineNumber: 1, newLineNumber: null, text: "old line" },
      { kind: "addition", oldLineNumber: null, newLineNumber: 1, text: "new line" },
      { kind: "context", oldLineNumber: 2, newLineNumber: 2, text: "context line" },
    ]);
  });

  it("captures rename and no-newline markers", () => {
    const document = parseRepositoryDiffDocument(
      "src/new-name.ts",
      [
        "diff --git a/src/old-name.ts b/src/new-name.ts",
        "similarity index 88%",
        "rename from src/old-name.ts",
        "rename to src/new-name.ts",
        "--- a/src/old-name.ts",
        "+++ b/src/new-name.ts",
        "@@ -1 +1 @@",
        "-before",
        "+after",
        "\\ No newline at end of file",
      ].join("\n")
    );

    expect(document.parseState).toBe("parsed");
    expect(document.files[0]?.changeType).toBe("renamed");
    expect(document.files[0]?.markers).toContain("rename");
    expect(document.files[0]?.markers).toContain("no-newline");
  });

  it("marks binary diffs explicitly", () => {
    const document = parseRepositoryDiffDocument(
      "logo.png",
      [
        "diff --git a/logo.png b/logo.png",
        "new file mode 100644",
        "index 0000000..1234567",
        "Binary files /dev/null and b/logo.png differ",
      ].join("\n")
    );

    expect(document.parseState).toBe("binary");
    expect(document.files[0]?.markers).toContain("binary");
    expect(document.files[0]?.changeType).toBe("added");
  });

  it("falls back to raw state when no diff file headers are present", () => {
    const document = parseRepositoryDiffDocument("README.md", "fatal: unsupported diff format");

    expect(document.parseState).toBe("raw");
    expect(document.files).toHaveLength(0);
    expect(document.warnings[0]).toContain("Unsupported diff content");
  });

  it("keeps partial parses visible when unsupported hunk lines appear", () => {
    const document = parseRepositoryDiffDocument(
      "src/conflict.ts",
      [
        "diff --git a/src/conflict.ts b/src/conflict.ts",
        "--- a/src/conflict.ts",
        "+++ b/src/conflict.ts",
        "@@ -1,1 +1,1 @@",
        "-before",
        "unexpected hunk payload",
        "+after",
      ].join("\n")
    );

    expect(document.parseState).toBe("partial");
    expect(document.files[0]?.hunks[0]?.lines.some((line) => line.kind === "meta")).toBe(true);
  });

  it("parses added and deleted files that use /dev/null patch paths", () => {
    const added = parseRepositoryDiffDocument(
      "notes.txt",
      [
        "diff --git a/notes.txt b/notes.txt",
        "new file mode 100644",
        "index 0000000..1234567",
        "--- /dev/null",
        "+++ b/notes.txt",
        "@@ -0,0 +1 @@",
        "+hello",
      ].join("\n")
    );
    const deleted = parseRepositoryDiffDocument(
      "legacy.txt",
      [
        "diff --git a/legacy.txt b/legacy.txt",
        "deleted file mode 100644",
        "index 1234567..0000000",
        "--- a/legacy.txt",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-goodbye",
      ].join("\n")
    );

    expect(added.files[0]?.oldPath).toBe("/dev/null");
    expect(added.files[0]?.changeType).toBe("added");
    expect(deleted.files[0]?.newPath).toBe("/dev/null");
    expect(deleted.files[0]?.changeType).toBe("deleted");
  });

  it("parses copy and mode-change headers without forcing a raw fallback", () => {
    const document = parseRepositoryDiffDocument(
      "src/copied.ts",
      [
        "diff --git a/src/original.ts b/src/copied.ts",
        "old mode 100644",
        "new mode 100755",
        "similarity index 100%",
        "copy from src/original.ts",
        "copy to src/copied.ts",
        "--- a/src/original.ts",
        "+++ b/src/copied.ts",
        "@@ -1 +1 @@",
        " export const value = 1;",
      ].join("\n")
    );

    expect(document.parseState).toBe("parsed");
    expect(document.files[0]?.changeType).toBe("copied");
    expect(document.files[0]?.markers).toEqual(expect.arrayContaining(["copy", "mode-change"]));
  });

  it("keeps malformed hunk headers visible as partial output", () => {
    const document = parseRepositoryDiffDocument(
      "src/bad.ts",
      [
        "diff --git a/src/bad.ts b/src/bad.ts",
        "--- a/src/bad.ts",
        "+++ b/src/bad.ts",
        "@@ broken @@",
        "+after",
        "",
      ].join("\n")
    );

    expect(document.parseState).toBe("partial");
    expect(document.warnings.some((warning) => warning.includes("Unsupported hunk header"))).toBe(true);
  });
});
