import { deduplicateDiagnostics } from "../../shared/index.js";
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
