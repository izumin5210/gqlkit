import type { Diagnostic, GraphQLTypeInfo } from "../types/index.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const BUILT_IN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

export function validateTypes(
  types: ReadonlyArray<GraphQLTypeInfo>,
): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  const typeNames = new Set(types.map((t) => t.name));

  for (const type of types) {
    if (type.kind === "Object" && type.fields) {
      for (const field of type.fields) {
        const typeName = field.type.typeName;

        if (!typeNames.has(typeName) && !BUILT_IN_SCALARS.has(typeName)) {
          diagnostics.push({
            code: "UNRESOLVED_REFERENCE",
            message: `Field '${field.name}' references unresolved type '${typeName}'`,
            severity: "error",
            location: { file: type.sourceFile, line: 1, column: 1 },
          });
        }
      }
    }

    if (type.kind === "Union" && type.unionMembers) {
      for (const member of type.unionMembers) {
        if (!typeNames.has(member) && !BUILT_IN_SCALARS.has(member)) {
          diagnostics.push({
            code: "UNRESOLVED_REFERENCE",
            message: `Union '${type.name}' references unresolved type '${member}'`,
            severity: "error",
            location: { file: type.sourceFile, line: 1, column: 1 },
          });
        }
      }
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}
