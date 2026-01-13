import { dirname } from "node:path";
import { define } from "gunshi";
import { loadConfig } from "../config-loader/index.js";
import { executeHooks } from "../gen-orchestrator/hook-executor/hook-executor.js";
import {
  executeGeneration,
  type GenerationConfig,
  writeGeneratedFiles,
} from "../gen-orchestrator/orchestrator.js";
import { createDiagnosticReporter } from "../gen-orchestrator/reporter/diagnostic-reporter.js";
import { createProgressReporter } from "../gen-orchestrator/reporter/progress-reporter.js";

export interface RunGenCommandOptions {
  readonly cwd: string;
}

export interface RunGenCommandResult {
  readonly exitCode: number;
}

export async function runGenCommand(
  options: RunGenCommandOptions,
): Promise<RunGenCommandResult> {
  const writer = {
    stdout: (msg: string) => console.log(msg),
    stderr: (msg: string) => console.error(msg),
  };

  const progressReporter = createProgressReporter(writer);
  const diagnosticReporter = createDiagnosticReporter(writer);

  const configResult = await loadConfig({ cwd: options.cwd });

  if (configResult.diagnostics.length > 0) {
    diagnosticReporter.reportDiagnostics(configResult.diagnostics);
    diagnosticReporter.reportError("Config load failed");
    return { exitCode: 1 };
  }

  const configDir = configResult.configPath
    ? dirname(configResult.configPath)
    : options.cwd;

  const { sourceDir, sourceIgnoreGlobs, output, scalars, tsconfigPath } =
    configResult.config;

  const config: GenerationConfig = {
    cwd: options.cwd,
    sourceDir,
    sourceIgnoreGlobs,
    output,
    configDir,
    customScalars: scalars,
    tsconfigPath,
  };

  progressReporter.startPhase("Extracting types");
  progressReporter.startPhase("Extracting resolvers");
  progressReporter.startPhase("Generating schema");

  const result = await executeGeneration(config);

  if (result.diagnostics.length > 0) {
    diagnosticReporter.reportDiagnostics(result.diagnostics);
  }

  if (!result.success) {
    diagnosticReporter.reportError("Generation failed");
    return { exitCode: 1 };
  }

  const writeResult = await writeGeneratedFiles({
    files: result.files,
  });

  if (!writeResult.success) {
    diagnosticReporter.reportError("Failed to write output files");
    return { exitCode: 1 };
  }

  for (const filePath of writeResult.filesWritten) {
    progressReporter.fileWritten(filePath);
  }
  progressReporter.complete();

  const { hooks } = configResult.config;
  let hookFailed = false;

  if (
    writeResult.filesWritten.length > 0 &&
    hooks.afterAllFileWrite.length > 0
  ) {
    progressReporter.startHookPhase();

    const hookResult = await executeHooks({
      commands: hooks.afterAllFileWrite,
      filePaths: writeResult.filesWritten,
      cwd: options.cwd,
      onHookComplete: (result) => {
        if (result.success) {
          progressReporter.hookCompleted(result.command);
        } else {
          progressReporter.hookFailed(
            result.command,
            result.exitCode,
            result.stderr,
          );
        }
      },
    });

    hookFailed = !hookResult.success;
    const failedCount = hookResult.results.filter((r) => !r.success).length;
    progressReporter.hookPhaseSummary(hookResult.results.length, failedCount);
  }

  if (hookFailed) {
    diagnosticReporter.reportError("Hook execution failed");
    return { exitCode: 1 };
  }

  diagnosticReporter.reportSuccess("Generation complete!");
  return { exitCode: 0 };
}

export const genCommand = define({
  name: "gen",
  args: {
    cwd: {
      type: "string",
      description: "Working directory for code generation",
    },
  },
  run: async (ctx) => {
    const cwd = ctx.values.cwd ?? process.cwd();
    const result = await runGenCommand({ cwd });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
  },
});
