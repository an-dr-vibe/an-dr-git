import {
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

  it("returns missing items in required order", () => {
    expect(findMissingItems(["a", "b", "c"], ["c"])).toEqual(["a", "b"]);
  });
});
