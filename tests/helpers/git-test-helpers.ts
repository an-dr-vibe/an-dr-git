import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCommand } from "../../src/main/git/run-command.js";

export async function createTempDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function runGitInDirectory(repositoryPath: string, args: readonly string[]): Promise<void> {
  const result = await runCommand("git", args, {
    cwd: repositoryPath,
    env: {
      ...process.env,
      GIT_PAGER: "cat",
      TERM: "dumb",
      LC_ALL: "C",
    },
    timeoutMs: 10_000,
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
}

export async function createRepositoryFixture(): Promise<string> {
  const repositoryPath = await createTempDirectory("an-dr-git-repo-");

  await runGitInDirectory(repositoryPath, ["init"]);
  await runGitInDirectory(repositoryPath, ["config", "user.name", "an-dr-git test"]);
  await runGitInDirectory(repositoryPath, ["config", "user.email", "test@example.com"]);
  await writeFile(join(repositoryPath, "README.md"), "# fixture\n", "utf8");
  await runGitInDirectory(repositoryPath, ["add", "README.md"]);
  await runGitInDirectory(repositoryPath, ["commit", "-m", "Initial commit"]);

  return repositoryPath;
}

export async function cleanupFixture(repositoryPath: string): Promise<void> {
  await rm(repositoryPath, { recursive: true, force: true });
}
