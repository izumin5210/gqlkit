import type { Diagnostic, GraphQLTypeInfo } from "../types/index.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface ValidateTypesOptions {
  readonly types: ReadonlyArray<GraphQLTypeInfo>;
  readonly customScalarNames?: ReadonlyArray<string> | undefined;
}

const BUILT_IN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

function isOptionsObject(
  arg: ReadonlyArray<GraphQLTypeInfo> | ValidateTypesOptions,
): arg is ValidateTypesOptions {
  return !Array.isArray(arg) && "types" in arg;
}

export function validateTypes(
  typesOrOptions: ReadonlyArray<GraphQLTypeInfo> | ValidateTypesOptions,
): ValidationResult {
  const types = isOptionsObject(typesOrOptions)
    ? typesOrOptions.types
    : typesOrOptions;
  const customScalarNames = isOptionsObject(typesOrOptions)
    ? typesOrOptions.customScalarNames
    : undefined;

  const diagnostics: Diagnostic[] = [];

  const typeNames = new Set(types.map((t) => t.name));
  const knownScalars = new Set([
    ...BUILT_IN_SCALARS,
    ...(customScalarNames ?? []),
  ]);

  for (const type of types) {
    if (type.kind === "Object" && type.fields) {
      for (const field of type.fields) {
        const typeName = field.type.typeName;

        if (!typeNames.has(typeName) && !knownScalars.has(typeName)) {
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
        if (!typeNames.has(member) && !knownScalars.has(member)) {
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
