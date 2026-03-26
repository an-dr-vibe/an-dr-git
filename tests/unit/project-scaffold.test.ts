import {
  REQUIRED_APP_SHELL_SCRIPTS,
  REQUIRED_PACKAGING_SCRIPTS,
  REQUIRED_PACKAGE_SCRIPTS,
  REQUIRED_SOURCE_DIRECTORIES,
  REQUIRED_TEST_DIRECTORIES,
  findMissingItems,
  getRequiredProjectDirectories,
} from "../../src/shared/domain/project-scaffold.js";

describe("project scaffold", () => {
  it("returns the required source and test directories in one list", () => {
    expect(getRequiredProjectDirectories()).toEqual([
      ...REQUIRED_SOURCE_DIRECTORIES,
      ...REQUIRED_TEST_DIRECTORIES,
    ]);
  });

  it("returns an empty array when all required items are present", () => {
    expect(findMissingItems(REQUIRED_PACKAGE_SCRIPTS, REQUIRED_PACKAGE_SCRIPTS)).toEqual([]);
  });

  it("tracks the app-shell launch scripts required for manual verification", () => {
    expect(REQUIRED_APP_SHELL_SCRIPTS).toEqual(["app:start", "app:smoke"]);
  });

  it("tracks the packaging scripts required for installer outputs and repo-local artifacts", () => {
    expect(REQUIRED_PACKAGING_SCRIPTS).toEqual([
      "package:dir",
      "package:verify",
      "make:win",
      "make:verify:win",
      "make:deb",
      "make:verify:deb",
    ]);
  });

  it("returns missing items in required order", () => {
    expect(findMissingItems(["a", "b", "c"], ["c"])).toEqual(["a", "b"]);
  });
});
