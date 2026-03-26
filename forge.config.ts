import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";

const config: ForgeConfig = {
  outDir: "artifacts/forge",
  packagerConfig: {
    asar: true,
    executableName: "an-dr-git",
    name: "an-dr-git",
  },
  makers: [
    new MakerSquirrel(
      {
        name: "AnDrGit",
        authors: "an-dr-vibe",
        description: "Cross-platform desktop Git client for Windows and Linux.",
        setupExe: "an-dr-git-setup.exe",
      },
      ["win32"]
    ),
    new MakerDeb(
      {
        options: {
          maintainer: "an-dr-vibe",
          homepage: "https://github.com/an-dr-vibe/an-dr-git",
          categories: ["Development"],
          section: "devel",
          description: "Cross-platform desktop Git client for Windows and Linux.",
        },
      },
      ["linux"]
    ),
  ],
};

export default config;
