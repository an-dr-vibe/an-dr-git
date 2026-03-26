import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const appEntryPoint = resolve(repositoryRoot, "dist", "main", "main", "index.js");
const isSmokeTest = process.argv.includes("--smoke-test");

const childProcess = spawn(electronBinary, [appEntryPoint], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    AN_DR_GIT_SMOKE_TEST: isSmokeTest ? "1" : "0",
  },
  stdio: "inherit",
});

childProcess.on("exit", (code, signal) => {
  if (signal !== null) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 0;
});
