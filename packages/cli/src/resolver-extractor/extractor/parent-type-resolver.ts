import type {
  Diagnostic,
  ExtractedTypeInfo,
  TSTypeReference,
} from "../../type-extractor/types/index.js";

export interface ParentTypeResolution {
  readonly success: boolean;
  readonly graphqlTypeName: string | null;
  readonly diagnostic: Diagnostic | null;
}

export function resolveParentType(
  parentTsType: TSTypeReference,
  typeDefinitions: ReadonlyArray<ExtractedTypeInfo>,
  sourceFile: string,
): ParentTypeResolution {
  if (parentTsType.kind !== "reference" || !parentTsType.name) {
    return {
      success: false,
      graphqlTypeName: null,
      diagnostic: {
        code: "MISSING_PARENT_TYPE",
        message:
          "Parent type must be a named type reference. Got an inline type definition.",
        severity: "error",
        location: {
          file: sourceFile,
          line: 1,
          column: 1,
        },
      },
    };
  }

  const typeName = parentTsType.name;

  const matchingType = typeDefinitions.find(
    (t) => t.metadata.name === typeName,
  );

  if (!matchingType) {
    return {
      success: false,
      graphqlTypeName: null,
      diagnostic: {
        code: "MISSING_PARENT_TYPE",
        message: `Parent type '${typeName}' is not defined in src/gql/types. Define it or use an existing type.`,
        severity: "error",
        location: {
          file: sourceFile,
          line: 1,
          column: 1,
        },
      },
    };
  }

  return {
    success: true,
    graphqlTypeName: typeName,
    diagnostic: null,
  };
}
