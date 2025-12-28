import type { Diagnostic } from "../../type-extractor/index.js";
import type { OutputWriter } from "./progress-reporter.js";

export interface DiagnosticReporter {
  reportDiagnostics(diagnostics: ReadonlyArray<Diagnostic>): void;
  reportError(message: string): void;
  reportSuccess(message: string): void;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const severity = diagnostic.severity;
  const code = diagnostic.code;
  const message = diagnostic.message;

  if (diagnostic.location) {
    const { file, line, column } = diagnostic.location;
    return `${file}:${line}:${column} - ${severity}[${code}]: ${message}`;
  }

  return `${severity}[${code}]: ${message}`;
}

export function createDiagnosticReporter(
  writer: OutputWriter,
): DiagnosticReporter {
  return {
    reportDiagnostics(diagnostics: ReadonlyArray<Diagnostic>): void {
      for (const diagnostic of diagnostics) {
        const formatted = formatDiagnostic(diagnostic);
        if (diagnostic.severity === "error") {
          writer.stderr(formatted);
        } else {
          writer.stdout(formatted);
        }
      }
    },
    reportError(message: string): void {
      writer.stderr(`error: ${message}`);
    },
    reportSuccess(message: string): void {
      writer.stdout(message);
    },
  };
}
