import type {
  Diagnostic,
  ExcludedFieldInfo,
  ExtractedTypeInfo,
  FieldDefinition,
  SourceLocation,
  TSTypeReference,
} from "../types/index.js";

export interface FieldFilterContext {
  readonly knownTypes: ReadonlySet<string>;
  readonly knownScalars: ReadonlySet<string>;
}

export interface FieldFilterResult {
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly excludedFields: ReadonlyArray<ExcludedFieldInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const GRAPHQL_PRIMITIVES = new Set(["string", "number", "boolean"]);

function hasUnderscorePrefix(fieldName: string): boolean {
  return fieldName.startsWith("_");
}

function isGraphQLRepresentable(
  tsType: TSTypeReference,
  context: FieldFilterContext,
): { representable: boolean; typeName: string | null } {
  switch (tsType.kind) {
    case "primitive": {
      if (GRAPHQL_PRIMITIVES.has(tsType.name ?? "")) {
        return { representable: true, typeName: null };
      }
      return { representable: false, typeName: tsType.name };
    }

    case "scalar": {
      return { representable: true, typeName: null };
    }

    case "literal": {
      return { representable: true, typeName: null };
    }

    case "reference": {
      const name = tsType.name ?? "";
      if (context.knownTypes.has(name) || context.knownScalars.has(name)) {
        return { representable: true, typeName: null };
      }
      return { representable: false, typeName: name };
    }

    case "array": {
      if (!tsType.elementType) {
        return { representable: true, typeName: null };
      }
      return isGraphQLRepresentable(tsType.elementType, context);
    }

    case "union": {
      if (!tsType.members) {
        return { representable: true, typeName: null };
      }
      for (const member of tsType.members) {
        const result = isGraphQLRepresentable(member, context);
        if (!result.representable) {
          return result;
        }
      }
      return { representable: true, typeName: null };
    }
  }

  return { representable: false, typeName: "unknown" };
}

function createExclusionDiagnostic(
  excludedField: ExcludedFieldInfo,
  selectableFields: ReadonlyArray<string>,
): Diagnostic {
  const { fieldName, typeName, reason, location } = excludedField;

  let message: string;
  if (reason.kind === "unsupported_type") {
    const pickExample =
      selectableFields.length > 0
        ? ` Consider using Pick<${typeName}, ${selectableFields.map((f) => `"${f}"`).join(" | ")}> to explicitly select fields.`
        : "";
    message = `Field '${fieldName}' of type '${typeName}' was auto-excluded because type '${reason.typeName}' is not representable in GraphQL.${pickExample}`;
  } else {
    message = `Field '${fieldName}' of type '${typeName}' was auto-excluded because field names starting with underscore are reserved.`;
  }

  return {
    code: "FIELD_AUTO_EXCLUDED",
    message,
    severity: "warning",
    location,
  };
}

function createAllFieldsExcludedDiagnostic(
  typeName: string,
  location: SourceLocation,
): Diagnostic {
  return {
    code: "ALL_FIELDS_EXCLUDED",
    message: `All fields of type '${typeName}' were excluded. At least one GraphQL-representable field is required.`,
    severity: "error",
    location,
  };
}

export function filterFields(
  typeInfo: ExtractedTypeInfo,
  context: FieldFilterContext,
): FieldFilterResult {
  const includedFields: FieldDefinition[] = [];
  const excludedFields: ExcludedFieldInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  const location: SourceLocation = {
    file: typeInfo.metadata.sourceFile,
    line: 1,
    column: 1,
  };

  for (const field of typeInfo.fields) {
    if (hasUnderscorePrefix(field.name)) {
      excludedFields.push({
        fieldName: field.name,
        typeName: typeInfo.metadata.name,
        reason: { kind: "underscore_prefix" },
        location,
      });
      continue;
    }

    const result = isGraphQLRepresentable(field.tsType, context);
    if (!result.representable) {
      excludedFields.push({
        fieldName: field.name,
        typeName: typeInfo.metadata.name,
        reason: {
          kind: "unsupported_type",
          typeName: result.typeName ?? "unknown",
        },
        location,
      });
      continue;
    }

    includedFields.push(field);
  }

  const selectableFieldNames = includedFields.map((f) => f.name);

  for (const excluded of excludedFields) {
    diagnostics.push(createExclusionDiagnostic(excluded, selectableFieldNames));
  }

  if (typeInfo.fields.length > 0 && includedFields.length === 0) {
    diagnostics.push(
      createAllFieldsExcludedDiagnostic(typeInfo.metadata.name, location),
    );
  }

  return {
    fields: includedFields,
    excludedFields,
    diagnostics,
  };
}
