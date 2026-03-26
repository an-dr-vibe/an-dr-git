export const REQUIRED_SOURCE_DIRECTORIES = [
  "src/main/app",
  "src/main/git",
  "src/main/ipc",
  "src/main/repo",
  "src/renderer/app",
  "src/renderer/components",
  "src/renderer/features",
  "src/renderer/pages",
  "src/renderer/state",
  "src/shared/contracts",
  "src/shared/domain",
  "src/shared/validation",
] as const;

export const REQUIRED_TEST_DIRECTORIES = [
  "tests/unit",
  "tests/integration",
  "tests/e2e",
] as const;

export const REQUIRED_PACKAGE_SCRIPTS = [
  "lint",
  "typecheck",
  "test:unit",
  "test:integration",
] as const;

export const REQUIRED_APP_SHELL_SCRIPTS = ["app:start", "app:smoke"] as const;

export const REQUIRED_PACKAGING_SCRIPTS = [
  "package:dir",
  "package:verify",
  "make:win",
  "make:verify:win",
  "make:deb",
  "make:verify:deb",
] as const;

export function getRequiredProjectDirectories(): string[] {
  return [...REQUIRED_SOURCE_DIRECTORIES, ...REQUIRED_TEST_DIRECTORIES];
}

export function findMissingItems(
  requiredItems: readonly string[],
  existingItems: Iterable<string>
): string[] {
  const existingItemSet = new Set(existingItems);

  return requiredItems.filter((requiredItem) => !existingItemSet.has(requiredItem));
}
