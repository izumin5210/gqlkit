import { join } from "node:path";
import { define } from "gunshi";
import {
  executeGeneration,
  type GenerationConfig,
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

  const config: GenerationConfig = {
    cwd: options.cwd,
    typesDir: join(options.cwd, "src/gql/types"),
    resolversDir: join(options.cwd, "src/gql/resolvers"),
    outputDir: join(options.cwd, "src/gqlkit/generated"),
  };

  progressReporter.startPhase("Extracting types");
  progressReporter.startPhase("Extracting resolvers");
  progressReporter.startPhase("Generating schema");

  const result = await executeGeneration(config);

  if (result.diagnostics.length > 0) {
    diagnosticReporter.reportDiagnostics(result.diagnostics);
  }

  if (result.success) {
    for (const filePath of result.filesWritten) {
      progressReporter.fileWritten(filePath);
    }
    progressReporter.complete();
    diagnosticReporter.reportSuccess("Generation complete!");
    return { exitCode: 0 };
  }

  diagnosticReporter.reportError("Generation failed");
  return { exitCode: 1 };
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
