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

function toFieldName(typeName: string): string {
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
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

  const typeMap = new Map<string, ExtractedTypeInfo>();
  for (const extracted of extractedTypes) {
    typeMap.set(extracted.metadata.name, extracted);
  }

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
        const unionMembers = extracted.unionMembers ?? [];

        const fieldNameMap = new Map<string, string>();
        let hasConflict = false;

        for (const memberName of unionMembers) {
          // Detect inline object literal types (TypeScript uses "__type" for anonymous types)
          if (memberName === "__type") {
            diagnostics.push({
              code: "ONEOF_FIELD_NAME_CONFLICT",
              message: `OneOf input object '${metadata.name}' contains inline object literal types. Please define named types (interface or type alias) for all union members.`,
              severity: "error",
              location: { file: metadata.sourceFile, line: 1, column: 1 },
            });
            hasConflict = true;
            continue;
          }

          const fieldName = toFieldName(memberName);
          const existingMember = fieldNameMap.get(fieldName);
          if (existingMember) {
            diagnostics.push({
              code: "ONEOF_FIELD_NAME_CONFLICT",
              message: `OneOf input object '${metadata.name}' has duplicate field name '${fieldName}' from types '${existingMember}' and '${memberName}'`,
              severity: "error",
              location: { file: metadata.sourceFile, line: 1, column: 1 },
            });
            hasConflict = true;
          } else {
            fieldNameMap.set(fieldName, memberName);
          }
        }

        if (hasConflict) {
          continue;
        }

        const sortedMembers = [...unionMembers].sort();
        const fields: FieldInfo[] = sortedMembers.map((memberName) => {
          const memberType = typeMap.get(memberName);
          return {
            name: toFieldName(memberName),
            type: {
              typeName: memberName,
              nullable: true,
              list: false,
              listItemNullable: null,
            },
            description: memberType?.metadata.description ?? null,
            deprecated: memberType?.metadata.deprecated ?? null,
          };
        });

        types.push({
          name: metadata.name,
          kind: "OneOfInputObject",
          fields,
          unionMembers: sortedMembers,
          enumValues: null,
          sourceFile: metadata.sourceFile,
          description: metadata.description,
          deprecated: metadata.deprecated,
        });
      } else {
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
      }
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
