import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "npm" | "yarn" | "pnpm";

export interface DetectPackageManagerOptions {
  readonly projectDir: string;
}

export interface DetectPackageManagerResult {
  readonly packageManager: PackageManager | null;
  readonly source: "packageManager" | "lockfile" | null;
}

const LOCKFILE_MAP: ReadonlyArray<{
  readonly file: string;
  readonly manager: PackageManager;
}> = [
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "package-lock.json", manager: "npm" },
];

function detectFromPackageManagerField(
  projectDir: string,
): PackageManager | null {
  const packageJsonPath = join(projectDir, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as { packageManager?: string };

    if (!pkg.packageManager) {
      return null;
    }

    const pmName = pkg.packageManager.split("@")[0];

    if (pmName === "npm" || pmName === "yarn" || pmName === "pnpm") {
      return pmName;
    }

    return null;
  } catch {
    return null;
  }
}

function detectFromLockfile(projectDir: string): PackageManager | null {
  for (const { file, manager } of LOCKFILE_MAP) {
    if (existsSync(join(projectDir, file))) {
      return manager;
    }
  }
  return null;
}

export async function detectPackageManager(
  options: DetectPackageManagerOptions,
): Promise<DetectPackageManagerResult> {
  const fromField = detectFromPackageManagerField(options.projectDir);
  if (fromField !== null) {
    return {
      packageManager: fromField,
      source: "packageManager",
    };
  }

  const fromLockfile = detectFromLockfile(options.projectDir);
  if (fromLockfile !== null) {
    return {
      packageManager: fromLockfile,
      source: "lockfile",
    };
  }

  return {
    packageManager: null,
    source: null,
  };
}
