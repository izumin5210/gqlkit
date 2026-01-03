import type { Diagnostic, Diagnostics } from "../type-extractor/types/index.js";

function getDiagnosticKey(d: Diagnostic): string {
  const locationKey = d.location
    ? `${d.location.file}:${d.location.line}:${d.location.column}`
    : "";
  return `${d.code}:${d.message}:${d.severity}:${locationKey}`;
}

export function deduplicateDiagnostics(
  diagnostics: ReadonlyArray<Diagnostic>,
): Diagnostic[] {
  const seen = new Set<string>();
  const result: Diagnostic[] = [];

  for (const d of diagnostics) {
    const key = getDiagnosticKey(d);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  }

  return result;
}

export function collectDiagnostics(
  allDiagnostics: ReadonlyArray<Diagnostic>,
): Diagnostics {
  const uniqueDiagnostics = deduplicateDiagnostics(allDiagnostics);
  const errors = uniqueDiagnostics.filter((d) => d.severity === "error");
  const warnings = uniqueDiagnostics.filter((d) => d.severity === "warning");

  return { errors, warnings };
}
