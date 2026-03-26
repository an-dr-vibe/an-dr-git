import {
  PHASE_0_STATE_MATRIX,
  getPhase0StateMatrix,
  resolvePhase0State,
} from "../../src/shared/domain/phase-0-state-matrix.js";

describe("phase 0 state matrix", () => {
  it("covers every required shell state once", () => {
    expect(PHASE_0_STATE_MATRIX.map((state) => state.id)).toEqual([
      "app-starting",
      "git-detecting",
      "git-missing",
      "no-repository",
      "repository-open-in-progress",
      "repository-opened",
      "invalid-repository",
      "unexpected-error",
    ]);
    expect(new Set(getPhase0StateMatrix().map((state) => state.id)).size).toBe(
      PHASE_0_STATE_MATRIX.length
    );
  });

  it("resolves the active state from shell conditions", () => {
    expect(
      resolvePhase0State({
        loadStateKind: "loading",
        gitStatus: undefined,
        activeRepository: false,
        isOpeningRepository: false,
        lastOpenResult: null,
      })
    ).toBe("app-starting");

    expect(
      resolvePhase0State({
        loadStateKind: "ready",
        gitStatus: {
          kind: "missing",
          error: {
            code: "GIT_MISSING",
            summary: "Missing Git",
            detail: "Install Git.",
          },
        },
        activeRepository: false,
        isOpeningRepository: false,
        lastOpenResult: null,
      })
    ).toBe("git-missing");

    expect(
      resolvePhase0State({
        loadStateKind: "ready",
        gitStatus: {
          kind: "ready",
          executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
          version: "2.49.0.windows.1",
        },
        activeRepository: false,
        isOpeningRepository: true,
        lastOpenResult: null,
      })
    ).toBe("repository-open-in-progress");

    expect(
      resolvePhase0State({
        loadStateKind: "ready",
        gitStatus: {
          kind: "ready",
          executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
          version: "2.49.0.windows.1",
        },
        activeRepository: true,
        isOpeningRepository: false,
        lastOpenResult: {
          kind: "opened",
          repository: {
            sessionId: "session-1",
            rootPath: "C:\\repos\\demo",
            gitDirectoryPath: "C:\\repos\\demo\\.git",
            currentHead: "main",
            isDetached: false,
            isUnborn: false,
          },
        },
      })
    ).toBe("repository-opened");

    expect(
      resolvePhase0State({
        loadStateKind: "ready",
        gitStatus: {
          kind: "ready",
          executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
          version: "2.49.0.windows.1",
        },
        activeRepository: false,
        isOpeningRepository: false,
        lastOpenResult: {
          kind: "error",
          error: {
            code: "NOT_A_REPOSITORY",
            summary: "Not a repository",
            detail: "Open a repository folder.",
          },
        },
      })
    ).toBe("invalid-repository");
  });
});
