import { convertTsTypeToGraphQLType } from "../../shared/type-converter.js";
import type {
  Diagnostic,
  EnumMemberInfo,
  EnumValueInfo,
  ExtractedTypeInfo,
  FieldInfo,
  GraphQLTypeInfo,
} from "../types/index.js";

export interface ConversionResult {
  readonly types: ReadonlyArray<GraphQLTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const RESERVED_TYPE_NAMES = new Set([
  "Int",
  "Float",
  "String",
  "Boolean",
  "ID",
  "Query",
  "Mutation",
  "Subscription",
]);

const GRAPHQL_ENUM_VALUE_PATTERN = /^[_A-Za-z][_0-9A-Za-z]*$/;

function isInputTypeName(name: string): boolean {
  return name.endsWith("Input");
}

function toScreamingSnakeCase(value: string): string {
  return value
    .replace(/[-\s]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

function isValidGraphQLEnumValue(value: string): boolean {
  if (value.length === 0) return false;
  return GRAPHQL_ENUM_VALUE_PATTERN.test(value);
}

function convertEnumMembers(
  members: ReadonlyArray<EnumMemberInfo>,
  sourceFile: string,
): {
  values: ReadonlyArray<EnumValueInfo>;
  diagnostics: ReadonlyArray<Diagnostic>;
} {
  const values: EnumValueInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const member of members) {
    const convertedName = toScreamingSnakeCase(member.name);

    if (!isValidGraphQLEnumValue(convertedName)) {
      diagnostics.push({
        code: "INVALID_ENUM_MEMBER",
        message: `Enum member '${member.name}' converts to '${convertedName}' which is not a valid GraphQL identifier`,
        severity: "error",
        location: { file: sourceFile, line: 1, column: 1 },
      });
      continue;
    }

    values.push({
      name: convertedName,
      originalValue: member.value,
      description: member.description,
      deprecated: member.deprecated,
    });
  }

  return { values, diagnostics };
}

function convertFields(extracted: ExtractedTypeInfo): FieldInfo[] {
  return extracted.fields.map((field) => ({
    name: field.name,
    type: convertTsTypeToGraphQLType(field.tsType, field.optional),
    description: field.description,
    deprecated: field.deprecated,
  }));
}

export function convertToGraphQL(
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>,
): ConversionResult {
  const types: GraphQLTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const extracted of extractedTypes) {
    const { metadata } = extracted;

    if (RESERVED_TYPE_NAMES.has(metadata.name)) {
      diagnostics.push({
        code: "RESERVED_TYPE_NAME",
        message: `Type name '${metadata.name}' conflicts with a GraphQL built-in type`,
        severity: "error",
        location: { file: metadata.sourceFile, line: 1, column: 1 },
      });
    }

    if (metadata.kind === "enum") {
      if (isInputTypeName(metadata.name)) {
        diagnostics.push({
          code: "INVALID_INPUT_TYPE",
          message: `Type '${metadata.name}' ends with 'Input' but is an enum type. Input types must be object types.`,
          severity: "error",
          location: { file: metadata.sourceFile, line: 1, column: 1 },
        });
      }

      const { values: enumValues, diagnostics: enumDiagnostics } =
        convertEnumMembers(extracted.enumMembers ?? [], metadata.sourceFile);
      diagnostics.push(...enumDiagnostics);

      types.push({
        name: metadata.name,
        kind: "Enum",
        fields: null,
        unionMembers: null,
        enumValues,
        sourceFile: metadata.sourceFile,
        description: metadata.description,
        deprecated: metadata.deprecated,
      });
    } else if (metadata.kind === "union") {
      if (isInputTypeName(metadata.name)) {
        diagnostics.push({
          code: "INVALID_INPUT_TYPE",
          message: `Type '${metadata.name}' ends with 'Input' but is a union type. Input types must be object types.`,
          severity: "error",
          location: { file: metadata.sourceFile, line: 1, column: 1 },
        });
      }

      const unionMembers = extracted.unionMembers
        ? [...extracted.unionMembers].sort()
        : [];

      types.push({
        name: metadata.name,
        kind: "Union",
        fields: null,
        unionMembers,
        enumValues: null,
        sourceFile: metadata.sourceFile,
        description: metadata.description,
        deprecated: null,
      });
    } else {
      const fields = convertFields(extracted);
      const isInput = isInputTypeName(metadata.name);

      types.push({
        name: metadata.name,
        kind: isInput ? "InputObject" : "Object",
        fields,
        unionMembers: null,
        enumValues: null,
        sourceFile: metadata.sourceFile,
        description: metadata.description,
        deprecated: metadata.deprecated,
      });
    }
  }

  return { types, diagnostics };
}
