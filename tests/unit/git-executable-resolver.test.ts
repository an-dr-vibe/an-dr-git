import { GitExecutableResolver } from "../../src/main/git/git-executable-resolver.js";

describe("GitExecutableResolver", () => {
  it("returns a missing-git status when the executable is absent", async () => {
    const resolver = new GitExecutableResolver({
      gitCommand: "an-dr-git-missing-git-executable",
    });

    const result = await resolver.resolveStatus();

    expect(result.kind).toBe("missing");

    if (result.kind !== "missing") {
      return;
    }

    expect(result.error.code).toBe("GIT_MISSING");
    expect(result.error.summary).toContain("System Git");
  });
});
