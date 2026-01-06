import { convertTsTypeToGraphQLType } from "../../shared/type-converter.js";
import type {
  Diagnostic,
  EnumMemberInfo,
  EnumValueInfo,
  ExtractedTypeInfo,
  FieldInfo,
  GraphQLTypeInfo,
  InlineObjectMember,
  InlineObjectProperty,
  SourceLocation,
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
    defaultValue: field.defaultValue,
  }));
}

const GRAPHQL_SCALAR_TYPES = new Set([
  "String",
  "Int",
  "Float",
  "Boolean",
  "ID",
]);

const PRIMITIVE_TO_GRAPHQL: Record<string, string> = {
  string: "String",
  number: "Float",
  boolean: "Boolean",
};

function isValidOneOfFieldType(
  typeName: string,
  typeMap: Map<string, ExtractedTypeInfo>,
): boolean {
  if (GRAPHQL_SCALAR_TYPES.has(typeName)) {
    return true;
  }
  if (PRIMITIVE_TO_GRAPHQL[typeName]) {
    return true;
  }
  const referencedType = typeMap.get(typeName);
  if (referencedType) {
    if (referencedType.metadata.kind === "enum") {
      return true;
    }
    if (isInputTypeName(referencedType.metadata.name)) {
      return true;
    }
  }
  return false;
}

interface OneOfValidationResult {
  readonly valid: boolean;
  readonly diagnostics: Diagnostic[];
  readonly fields: FieldInfo[];
}

function validateAndConvertInlineObjectMembers(
  members: ReadonlyArray<InlineObjectMember>,
  typeName: string,
  location: SourceLocation,
  typeMap: Map<string, ExtractedTypeInfo>,
): OneOfValidationResult {
  const diagnostics: Diagnostic[] = [];
  const fields: FieldInfo[] = [];
  const propertyNames = new Set<string>();
  const allProperties: InlineObjectProperty[] = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i]!;
    const props = member.properties;

    if (props.length === 0) {
      diagnostics.push({
        code: "ONEOF_EMPTY_OBJECT",
        message: `OneOf input '${typeName}' member at index ${i} is an empty object. Each member must have exactly one property.`,
        severity: "error",
        location,
      });
      continue;
    }

    if (props.length > 1) {
      diagnostics.push({
        code: "ONEOF_MULTIPLE_PROPERTIES",
        message: `OneOf input '${typeName}' member at index ${i} has ${props.length} properties. Each member must have exactly one property.`,
        severity: "error",
        location,
      });
      continue;
    }

    allProperties.push(props[0]!);
  }

  for (const prop of allProperties) {
    if (propertyNames.has(prop.propertyName)) {
      diagnostics.push({
        code: "ONEOF_DUPLICATE_PROPERTY",
        message: `OneOf input '${typeName}' has duplicate property name '${prop.propertyName}'.`,
        severity: "error",
        location,
      });
      continue;
    }
    propertyNames.add(prop.propertyName);

    const graphqlType = convertTsTypeToGraphQLType(prop.propertyType, false);
    const referencedTypeName = graphqlType.typeName;

    if (!isValidOneOfFieldType(referencedTypeName, typeMap)) {
      diagnostics.push({
        code: "ONEOF_INVALID_FIELD_TYPE",
        message: `OneOf input '${typeName}' field '${prop.propertyName}' has invalid type '${referencedTypeName}'. Only scalar types and Input Object types are allowed.`,
        severity: "error",
        location,
      });
      continue;
    }

    fields.push({
      name: prop.propertyName,
      type: {
        typeName: graphqlType.typeName,
        nullable: true,
        list: graphqlType.list,
        listItemNullable: graphqlType.listItemNullable,
      },
      description: prop.description,
      deprecated: prop.deprecated,
      defaultValue: null,
    });
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
    fields: fields.sort((a, b) => a.name.localeCompare(b.name)),
  };
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
        const inlineObjectMembers = extracted.inlineObjectMembers ?? [];

        if (inlineObjectMembers.length > 0) {
          const location = { file: metadata.sourceFile, line: 1, column: 1 };
          const validationResult = validateAndConvertInlineObjectMembers(
            inlineObjectMembers,
            metadata.name,
            location,
            typeMap,
          );

          diagnostics.push(...validationResult.diagnostics);

          if (validationResult.valid) {
            types.push({
              name: metadata.name,
              kind: "OneOfInputObject",
              fields: validationResult.fields,
              unionMembers: null,
              enumValues: null,
              sourceFile: metadata.sourceFile,
              description: metadata.description,
              deprecated: metadata.deprecated,
            });
          }
        }
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
