import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface UpdatePackageJsonOptions {
  readonly projectDir: string;
  readonly dependencies: ReadonlyArray<{
    readonly name: string;
    readonly version: string;
  }>;
}

export interface PackageJsonDiagnostic {
  readonly code:
    | "INIT_PACKAGE_JSON_NOT_FOUND"
    | "INIT_PACKAGE_JSON_PARSE_ERROR";
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
  readonly location: null;
}

export interface UpdatePackageJsonResult {
  readonly updated: boolean;
  readonly addedDependencies: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<PackageJsonDiagnostic>;
}

export async function updatePackageJson(
  options: UpdatePackageJsonOptions,
): Promise<UpdatePackageJsonResult> {
  const packageJsonPath = join(options.projectDir, "package.json");

  if (!existsSync(packageJsonPath)) {
    return {
      updated: false,
      addedDependencies: [],
      diagnostics: [
        {
          code: "INIT_PACKAGE_JSON_NOT_FOUND",
          message: `package.json not found in ${options.projectDir}`,
          severity: "error",
          location: null,
        },
      ],
    };
  }

  let packageJson: Record<string, unknown>;
  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    packageJson = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {
      updated: false,
      addedDependencies: [],
      diagnostics: [
        {
          code: "INIT_PACKAGE_JSON_PARSE_ERROR",
          message: `Failed to parse package.json in ${options.projectDir}`,
          severity: "error",
          location: null,
        },
      ],
    };
  }

  const existingDeps =
    (packageJson["dependencies"] as Record<string, string> | undefined) ?? {};
  const addedDependencies: string[] = [];

  for (const dep of options.dependencies) {
    if (!(dep.name in existingDeps)) {
      existingDeps[dep.name] = dep.version;
      addedDependencies.push(dep.name);
    }
  }

  if (addedDependencies.length === 0) {
    return {
      updated: false,
      addedDependencies: [],
      diagnostics: [],
    };
  }

  packageJson["dependencies"] = existingDeps;

  const output = JSON.stringify(packageJson, null, 2) + "\n";
  writeFileSync(packageJsonPath, output, "utf-8");

  return {
    updated: true,
    addedDependencies,
    diagnostics: [],
  };
}
