import { dirname } from "node:path";
import { define } from "gunshi";
import {
  loadConfig,
  type ResolvedHooksConfig,
} from "../config-loader/index.js";
import { executeHooks } from "../gen-orchestrator/hook-executor/hook-executor.js";
import {
  executeGeneration,
  type GenerationConfig,
  type GenerationResult,
  type WriteFilesResult,
  writeGeneratedFiles,
} from "../gen-orchestrator/orchestrator.js";
import {
  createDiagnosticReporter,
  type DiagnosticReporter,
} from "../gen-orchestrator/reporter/diagnostic-reporter.js";
import {
  createProgressReporter,
  type ProgressReporter,
} from "../gen-orchestrator/reporter/progress-reporter.js";

export interface RunGenCommandOptions {
  readonly cwd: string;
  readonly configPath: string | null;
}

export interface RunGenCommandResult {
  readonly exitCode: number;
}

/**
 * Outcome of a pipeline step: either the pipeline continues with `value`,
 * or it terminates early with the given exit code.
 */
type StepResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly exitCode: number };

interface AdaptedConfig {
  readonly generationConfig: GenerationConfig;
  readonly hooks: ResolvedHooksConfig;
}

interface LoadAndAdaptConfigParams {
  readonly cwd: string;
  readonly configPath: string | null;
  readonly diagnosticReporter: DiagnosticReporter;
}

/** Loads the config file and adapts it into the orchestrator's `GenerationConfig` shape. */
async function loadAndAdaptConfig(
  params: LoadAndAdaptConfigParams,
): Promise<StepResult<AdaptedConfig>> {
  const { cwd, configPath, diagnosticReporter } = params;

  const configResult = await loadConfig({ cwd, configPath });

  if (configResult.diagnostics.length > 0) {
    diagnosticReporter.reportDiagnostics(configResult.diagnostics);
    diagnosticReporter.reportError("Config load failed");
    return { ok: false, exitCode: 1 };
  }

  const configDir = configResult.configPath
    ? dirname(configResult.configPath)
    : cwd;

  const {
    sourceDir,
    sourceIgnoreGlobs,
    output,
    scalars,
    tsconfigPath,
    discriminatorFields,
    hooks,
  } = configResult.config;

  const generationConfig: GenerationConfig = {
    cwd,
    sourceDir,
    sourceIgnoreGlobs,
    output,
    configDir,
    customScalars: scalars,
    tsconfigPath,
    discriminatorFields,
  };

  return { ok: true, value: { generationConfig, hooks } };
}

interface RunGenerationParams {
  readonly generationConfig: GenerationConfig;
  readonly progressReporter: ProgressReporter;
}

/** Announces the pipeline phases and runs type/resolver/schema generation. */
async function runGeneration(
  params: RunGenerationParams,
): Promise<GenerationResult> {
  const { generationConfig, progressReporter } = params;

  progressReporter.startPhase("Extracting types");
  progressReporter.startPhase("Extracting resolvers");
  progressReporter.startPhase("Generating schema");

  return executeGeneration(generationConfig);
}

interface ReportGenerationDiagnosticsParams {
  readonly result: GenerationResult;
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
}

/** Reports generation diagnostics/pruned types and gates on generation success. */
function reportGenerationDiagnostics(
  params: ReportGenerationDiagnosticsParams,
): StepResult<GenerationResult> {
  const { result, progressReporter, diagnosticReporter } = params;

  if (result.diagnostics.length > 0) {
    diagnosticReporter.reportDiagnostics(result.diagnostics);
  }

  if (!result.success) {
    diagnosticReporter.reportError("Generation failed");
    return { ok: false, exitCode: 1 };
  }

  if (result.prunedTypes.length > 0) {
    progressReporter.typesPruned(result.prunedTypes);
  }

  return { ok: true, value: result };
}

interface WriteOutputFilesParams {
  readonly files: GenerationResult["files"];
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
}

/** Writes generated files to disk and gates on write success. */
async function writeOutputFiles(
  params: WriteOutputFilesParams,
): Promise<StepResult<WriteFilesResult>> {
  const { files, progressReporter, diagnosticReporter } = params;

  const writeResult = await writeGeneratedFiles({ files });

  if (!writeResult.success) {
    const cause = writeResult.error ? `: ${writeResult.error.message}` : "";
    diagnosticReporter.reportError(`Failed to write output files${cause}`);
    return { ok: false, exitCode: 1 };
  }

  for (const filePath of writeResult.filesWritten) {
    progressReporter.fileWritten(filePath);
  }
  progressReporter.complete();

  return { ok: true, value: writeResult };
}

interface RunAfterWriteHooksParams {
  readonly hooks: ResolvedHooksConfig;
  readonly filesWritten: ReadonlyArray<string>;
  readonly cwd: string;
  readonly progressReporter: ProgressReporter;
}

interface RunAfterWriteHooksResult {
  readonly hookFailed: boolean;
}

/** Runs `afterAllFileWrite` hooks, if any are configured and files were written. */
async function runAfterWriteHooks(
  params: RunAfterWriteHooksParams,
): Promise<RunAfterWriteHooksResult> {
  const { hooks, filesWritten, cwd, progressReporter } = params;

  if (filesWritten.length === 0 || hooks.afterAllFileWrite.length === 0) {
    return { hookFailed: false };
  }

  progressReporter.startHookPhase();

  const hookResult = await executeHooks({
    commands: hooks.afterAllFileWrite,
    filePaths: filesWritten,
    cwd,
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

  const failedCount = hookResult.results.filter((r) => !r.success).length;
  progressReporter.hookPhaseSummary(hookResult.results.length, failedCount);

  return { hookFailed: !hookResult.success };
}

interface ReportOutcomeParams {
  readonly hookFailed: boolean;
  readonly diagnosticReporter: DiagnosticReporter;
}

/** Reports the final outcome and determines the process exit code. */
function reportOutcome(params: ReportOutcomeParams): RunGenCommandResult {
  const { hookFailed, diagnosticReporter } = params;

  if (hookFailed) {
    diagnosticReporter.reportError("Hook execution failed");
    return { exitCode: 1 };
  }

  diagnosticReporter.reportSuccess("Generation complete!");
  return { exitCode: 0 };
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

  const configStep = await loadAndAdaptConfig({
    cwd: options.cwd,
    configPath: options.configPath,
    diagnosticReporter,
  });
  if (!configStep.ok) {
    return { exitCode: configStep.exitCode };
  }
  const { generationConfig, hooks } = configStep.value;

  const generationResult = await runGeneration({
    generationConfig,
    progressReporter,
  });

  const diagnosticsStep = reportGenerationDiagnostics({
    result: generationResult,
    progressReporter,
    diagnosticReporter,
  });
  if (!diagnosticsStep.ok) {
    return { exitCode: diagnosticsStep.exitCode };
  }

  const writeStep = await writeOutputFiles({
    files: diagnosticsStep.value.files,
    progressReporter,
    diagnosticReporter,
  });
  if (!writeStep.ok) {
    return { exitCode: writeStep.exitCode };
  }

  const { hookFailed } = await runAfterWriteHooks({
    hooks,
    filesWritten: writeStep.value.filesWritten,
    cwd: options.cwd,
    progressReporter,
  });

  return reportOutcome({ hookFailed, diagnosticReporter });
}

export const genCommand = define({
  name: "gen",
  args: {
    cwd: {
      type: "string",
      description: "Working directory for code generation",
    },
    config: {
      type: "string",
      short: "c",
      description: "Path to config file",
    },
  },
  run: async (ctx) => {
    const cwd = ctx.values.cwd ?? process.cwd();
    const configPath = ctx.values.config ?? null;
    const result = await runGenCommand({ cwd, configPath });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
  },
});
