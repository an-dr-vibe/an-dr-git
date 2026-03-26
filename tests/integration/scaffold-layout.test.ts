import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_PACKAGE_SCRIPTS,
  findMissingItems,
  getRequiredProjectDirectories,
} from "../../src/shared/domain/project-scaffold.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, "..", "..");

type PackageJsonWithScripts = {
  scripts?: Record<string, string>;
};

describe("phase 0 scaffold integration", () => {
  it("creates the required source and test directories", () => {
    const existingDirectories = getRequiredProjectDirectories().filter(
      (relativePath: string) => existsSync(resolve(repositoryRoot, relativePath))
    );

    expect(findMissingItems(getRequiredProjectDirectories(), existingDirectories)).toEqual([]);
  });

  it("defines the required package scripts", () => {
    const packageJsonPath = resolve(repositoryRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonWithScripts;
    const existingScripts = Object.keys(packageJson.scripts ?? {});

    expect(findMissingItems(REQUIRED_PACKAGE_SCRIPTS, existingScripts)).toEqual([]);
  });
});
