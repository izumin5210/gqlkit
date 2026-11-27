import { define } from "gunshi";
import {
  detectExistingProject,
  detectPackageManager,
  generateFiles,
  resolveProjectDirectory,
  runCommand,
  updatePackageJson,
} from "../init-orchestrator/index.js";
import { runGenCommand } from "./gen.js";

export interface RunInitCommandOptions {
  readonly cwd: string;
  readonly dir: string | null;
}

export interface RunInitCommandResult {
  readonly exitCode: number;
}

interface OutputWriter {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

function createWriter(): OutputWriter {
  return {
    stdout: (msg: string) => console.log(msg),
    stderr: (msg: string) => console.error(msg),
  };
}

export async function runInitCommand(
  options: RunInitCommandOptions,
): Promise<RunInitCommandResult> {
  const writer = createWriter();

  writer.stdout("Initializing gqlkit project...");

  const directoryResult = await resolveProjectDirectory({
    cwd: options.cwd,
    dir: options.dir,
  });

  if (directoryResult.diagnostics.length > 0) {
    for (const diagnostic of directoryResult.diagnostics) {
      writer.stderr(`error[${diagnostic.code}]: ${diagnostic.message}`);
    }
    return { exitCode: 1 };
  }

  if (directoryResult.directories === null) {
    writer.stderr("error: Failed to resolve project directory");
    return { exitCode: 1 };
  }

  const { projectDir, gqlkitDir, schemaDir } = directoryResult.directories;

  writer.stdout(`  Project directory: ${projectDir}`);

  const existingResult = await detectExistingProject({
    gqlkitDir,
    schemaDir,
  });

  if (existingResult.hasExistingSetup) {
    writer.stdout(
      "  Detected existing gqlkit setup, skipping context.ts and gqlkit.ts",
    );
    for (const file of existingResult.detectedFiles) {
      writer.stdout(`    Found: ${file}`);
    }
  }

  writer.stdout("  Generating files...");

  const generateResult = await generateFiles({
    gqlkitDir,
    schemaDir,
    skipGqlkitSetup: existingResult.hasExistingSetup,
  });

  for (const file of generateResult.files) {
    if (file.skipped) {
      writer.stdout(`    Skipped: ${file.path} (${file.reason})`);
    } else {
      writer.stdout(`    Created: ${file.path}`);
    }
  }

  writer.stdout("  Updating package.json...");

  const updateResult = await updatePackageJson({
    projectDir,
    dependencies: [
      { name: "@gqlkit-ts/runtime", version: "latest" },
      { name: "@graphql-tools/schema", version: "latest" },
    ],
  });

  if (updateResult.diagnostics.length > 0) {
    for (const diagnostic of updateResult.diagnostics) {
      writer.stderr(`error[${diagnostic.code}]: ${diagnostic.message}`);
    }
    return { exitCode: 1 };
  }

  if (updateResult.updated) {
    writer.stdout(
      `    Added dependencies: ${updateResult.addedDependencies.join(", ")}`,
    );
  } else {
    writer.stdout("    All dependencies already present");
  }

  writer.stdout("  Running gqlkit gen...");

  const genResult = await runGenCommand({ cwd: projectDir });

  if (genResult.exitCode !== 0) {
    writer.stderr("error[INIT_GEN_FAILED]: gqlkit gen failed");
    return { exitCode: 1 };
  }

  if (updateResult.updated) {
    writer.stdout("  Detecting package manager...");

    const pmResult = await detectPackageManager({ projectDir });

    if (pmResult.packageManager !== null) {
      writer.stdout(
        `    Found: ${pmResult.packageManager} (from ${pmResult.source})`,
      );
      writer.stdout("  Installing dependencies...");

      const installArgs = ["install"];

      const installResult = await runCommand({
        command: pmResult.packageManager,
        args: installArgs,
        cwd: projectDir,
      });

      if (!installResult.success) {
        writer.stderr(
          `warning[INIT_INSTALL_FAILED]: Failed to install dependencies (exit code: ${installResult.exitCode})`,
        );
        writer.stdout(
          `    Please run '${pmResult.packageManager} install' manually`,
        );
      } else {
        writer.stdout("    Dependencies installed successfully");
      }
    } else {
      writer.stdout("    Package manager not detected");
      writer.stdout(
        "    Please install dependencies manually: npm install, yarn install, or pnpm install",
      );
    }
  }

  writer.stdout("gqlkit init complete!");
  return { exitCode: 0 };
}

export const initCommand = define({
  name: "init",
  args: {
    dir: {
      type: "string",
      description: "Project directory to initialize",
    },
    cwd: {
      type: "string",
      description: "Working directory",
    },
  },
  run: async (ctx) => {
    const cwd = ctx.values.cwd ?? process.cwd();
    const dir = ctx.values.dir ?? null;
    const result = await runInitCommand({ cwd, dir });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
  },
});
