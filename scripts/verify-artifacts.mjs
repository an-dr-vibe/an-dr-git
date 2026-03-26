import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const forgeOutputDirectory = resolve(repositoryRoot, "artifacts", "forge");
const mode = process.argv[2];

function findDirectories(parentDirectory) {
  if (!existsSync(parentDirectory)) {
    return [];
  }

  return readdirSync(parentDirectory)
    .map((entry) => join(parentDirectory, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory());
}

function findFiles(parentDirectory, predicate, results = []) {
  if (!existsSync(parentDirectory)) {
    return results;
  }

  for (const entry of readdirSync(parentDirectory)) {
    const entryPath = join(parentDirectory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      findFiles(entryPath, predicate, results);
      continue;
    }

    if (predicate(entryPath)) {
      results.push(entryPath);
    }
  }

  return results;
}

async function smokeLaunchExecutable(executablePath) {
  await new Promise((resolvePromise, rejectPromise) => {
    const childProcess = spawn(executablePath, [], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        AN_DR_GIT_SMOKE_TEST: "1",
      },
      stdio: "inherit",
    });

    childProcess.on("error", rejectPromise);
    childProcess.on("exit", (code, signal) => {
      if (signal !== null || code !== 0) {
        rejectPromise(new Error(`Packaged executable exited with code '${code}' and signal '${signal}'.`));
        return;
      }

      resolvePromise(undefined);
    });
  });
}

function getPackagedExecutablePath() {
  const packagedDirectories = findDirectories(forgeOutputDirectory).filter((entryPath) =>
    entryPath.includes("an-dr-git-")
  );

  for (const packagedDirectory of packagedDirectories) {
    const executablePath =
      process.platform === "win32"
        ? join(packagedDirectory, "an-dr-git.exe")
        : join(packagedDirectory, "an-dr-git");

    if (existsSync(executablePath)) {
      return executablePath;
    }
  }

  throw new Error("Packaged executable was not found under artifacts/forge.");
}

function verifyRendererAssetPaths() {
  const rendererIndexPath = resolve(repositoryRoot, "dist", "renderer", "index.html");

  if (!existsSync(rendererIndexPath)) {
    throw new Error("Renderer index.html was not found under dist/renderer.");
  }

  const rendererIndexContent = readFileSync(rendererIndexPath, "utf8");

  if (rendererIndexContent.includes('src="/assets/') || rendererIndexContent.includes('href="/assets/')) {
    throw new Error(
      "Renderer build contains root-relative asset paths. Packaged Electron builds require relative asset paths."
    );
  }
}

function verifyWindowsInstaller() {
  const installerFiles = findFiles(
    resolve(forgeOutputDirectory, "make"),
    (entryPath) => entryPath.toLowerCase().endsWith(".exe") && entryPath.toLowerCase().includes("setup")
  );

  if (installerFiles.length === 0) {
    throw new Error("Windows installer was not found under artifacts/forge/make.");
  }

  console.log(`Verified Windows installer: ${installerFiles[0]}`);
}

function verifyDebianInstaller() {
  const debianPackages = findFiles(resolve(forgeOutputDirectory, "make"), (entryPath) =>
    entryPath.toLowerCase().endsWith(".deb")
  );

  if (debianPackages.length === 0) {
    throw new Error("Debian installer was not found under artifacts/forge/make.");
  }

  console.log(`Verified Debian installer: ${debianPackages[0]}`);
}

async function main() {
  verifyRendererAssetPaths();

  switch (mode) {
    case "package": {
      const executablePath = getPackagedExecutablePath();
      console.log(`Verified packaged executable: ${executablePath}`);
      await smokeLaunchExecutable(executablePath);
      return;
    }
    case "make-win32":
      verifyWindowsInstaller();
      return;
    case "make-linux":
      verifyDebianInstaller();
      return;
    default:
      throw new Error("Expected one of: package, make-win32, make-linux.");
  }
}

await main();
