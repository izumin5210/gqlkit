import type { Diagnostic, DiagnosticCode } from "../core/index.js";

export interface MakeConfigDiagnosticParams {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly configPath: string;
}

/**
 * Builds a config-file validation diagnostic. Every config diagnostic points
 * at line 1, column 1 of the config file: gqlkit.config.ts is validated as a
 * resolved JS/TS module (via jiti), not parsed for precise source positions,
 * so there is no finer-grained location to report.
 */
export function makeConfigDiagnostic(
  params: MakeConfigDiagnosticParams,
): Diagnostic {
  const { code, message, configPath } = params;
  return {
    code,
    message,
    severity: "error",
    location: { file: configPath, line: 1, column: 1 },
  };
}
