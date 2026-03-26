import {
  APP_SHELL_NAME,
  APP_SHELL_PANELS,
  APP_SHELL_VERSION,
  getAppShellPanels,
} from "../../src/shared/domain/app-shell-layout.js";

describe("app shell layout", () => {
  it("defines the phase 0.5 shell identity", () => {
    expect(APP_SHELL_NAME).toBe("an-dr-git");
    expect(APP_SHELL_VERSION).toBe("phase-0-slice-0.5");
  });

  it("returns the expected panels in order", () => {
    expect(getAppShellPanels().map((panel) => panel.id)).toEqual([
      "repository-tree",
      "branch-state",
      "diff-inspector",
    ]);
  });

  it("keeps panel definitions descriptive and unique", () => {
    expect(new Set(APP_SHELL_PANELS.map((panel) => panel.id)).size).toBe(APP_SHELL_PANELS.length);

    for (const panel of APP_SHELL_PANELS) {
      expect(panel.title.length).toBeGreaterThan(0);
      expect(panel.description.length).toBeGreaterThan(20);
    }
  });
});
