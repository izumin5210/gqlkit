import type {
  Diagnostic,
  Diagnostics,
  FieldInfo,
  GraphQLTypeInfo,
} from "../types/index.js";

export interface ExtractTypesResult {
  readonly types: ReadonlyArray<GraphQLTypeInfo>;
  readonly diagnostics: Diagnostics;
}

function sortFields(fields: ReadonlyArray<FieldInfo>): FieldInfo[] {
  return [...fields].sort((a, b) => a.name.localeCompare(b.name));
}

function sortUnionMembers(members: ReadonlyArray<string>): string[] {
  return [...members].sort((a, b) => a.localeCompare(b));
}

function sortType(type: GraphQLTypeInfo): GraphQLTypeInfo {
  if (type.kind === "Object" && type.fields) {
    return {
      ...type,
      fields: sortFields(type.fields),
    };
  }

  if (type.kind === "Union" && type.unionMembers) {
    return {
      ...type,
      unionMembers: sortUnionMembers(type.unionMembers),
    };
  }

  return type;
}

function getDiagnosticKey(d: Diagnostic): string {
  const locationKey = d.location
    ? `${d.location.file}:${d.location.line}:${d.location.column}`
    : "";
  return `${d.code}:${d.message}:${d.severity}:${locationKey}`;
}

function deduplicateDiagnostics(
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

export function collectResults(
  types: ReadonlyArray<GraphQLTypeInfo>,
  diagnostics: ReadonlyArray<Diagnostic>,
): ExtractTypesResult {
  const sortedTypes = [...types]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(sortType);

  const uniqueDiagnostics = deduplicateDiagnostics(diagnostics);

  const errors = uniqueDiagnostics.filter((d) => d.severity === "error");
  const warnings = uniqueDiagnostics.filter((d) => d.severity === "warning");

  return {
    types: sortedTypes,
    diagnostics: { errors, warnings },
  };
}
