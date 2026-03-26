import {
  getPhase1StateMatrix,
  resolvePhase1State,
} from "../../src/shared/domain/phase-1-state-matrix.js";

describe("phase 1 state matrix", () => {
  it("defines the expected repository-state coverage", () => {
    expect(getPhase1StateMatrix().map((state) => state.id)).toEqual([
      "empty",
      "loading",
      "ready",
      "refreshing",
      "stale",
      "error",
    ]);
  });

  it("resolves snapshot states into explicit UI states", () => {
    expect(
      resolvePhase1State({
        activeRepository: null,
        snapshot: null,
        error: null,
        refreshState: "idle",
        isStale: false,
        refreshedAt: null,
      })
    ).toBe("empty");

    expect(
      resolvePhase1State({
        activeRepository: {
          sessionId: "session-1",
          rootPath: "/repo",
          gitDirectoryPath: "/repo/.git",
          currentHead: "main",
          isDetached: false,
          isUnborn: false,
        },
        snapshot: null,
        error: null,
        refreshState: "loading",
        isStale: false,
        refreshedAt: null,
      })
    ).toBe("loading");

    expect(
      resolvePhase1State({
        activeRepository: {
          sessionId: "session-1",
          rootPath: "/repo",
          gitDirectoryPath: "/repo/.git",
          currentHead: "main",
          isDetached: false,
          isUnborn: false,
        },
        snapshot: null,
        error: {
          code: "UNEXPECTED",
          summary: "Snapshot failed.",
          detail: "Git returned an error.",
        },
        refreshState: "idle",
        isStale: false,
        refreshedAt: null,
      })
    ).toBe("error");

    expect(
      resolvePhase1State({
        activeRepository: {
          sessionId: "session-1",
          rootPath: "/repo",
          gitDirectoryPath: "/repo/.git",
          currentHead: "main",
          isDetached: false,
          isUnborn: false,
        },
        snapshot: null,
        error: null,
        refreshState: "refreshing",
        isStale: false,
        refreshedAt: "2026-03-26T20:00:00.000Z",
      })
    ).toBe("refreshing");

    expect(
      resolvePhase1State({
        activeRepository: {
          sessionId: "session-1",
          rootPath: "/repo",
          gitDirectoryPath: "/repo/.git",
          currentHead: "main",
          isDetached: false,
          isUnborn: false,
        },
        snapshot: null,
        error: null,
        refreshState: "idle",
        isStale: true,
        refreshedAt: "2026-03-26T20:00:00.000Z",
      })
    ).toBe("stale");

    expect(
      resolvePhase1State({
        activeRepository: {
          sessionId: "session-1",
          rootPath: "/repo",
          gitDirectoryPath: "/repo/.git",
          currentHead: "main",
          isDetached: false,
          isUnborn: false,
        },
        snapshot: null,
        error: null,
        refreshState: "idle",
        isStale: false,
        refreshedAt: "2026-03-26T20:00:00.000Z",
      })
    ).toBe("ready");
  });
});
