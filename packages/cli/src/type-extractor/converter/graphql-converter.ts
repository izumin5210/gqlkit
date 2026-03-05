import { isTypenameFieldName } from "../../auto-type-generator/typename-types.js";
import {
  BUILT_IN_SCALARS,
  isBuiltInScalar,
  PRIMITIVE_TYPE_MAP,
} from "../../shared/constants.js";
import {
  detectEnumPrefix,
  stripEnumPrefix,
} from "../../shared/enum-prefix-detector.js";
import { toScreamingSnakeCase } from "../../shared/string-utils.js";
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
import { isEligibleAsEnumValue, isEligibleField } from "./field-eligibility.js";

export interface ConversionResult {
  readonly types: ReadonlyArray<GraphQLTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const RESERVED_TYPE_NAMES = new Set([
  ...BUILT_IN_SCALARS,
  "Query",
  "Mutation",
  "Subscription",
]);

function isInputTypeName(name: string): boolean {
  return name.endsWith("Input");
}

interface ConvertEnumMembersParams {
  readonly members: ReadonlyArray<EnumMemberInfo>;
  readonly enumName: string;
  readonly sourceFile: string;
  readonly enumLocation: SourceLocation;
}

interface ConvertEnumMembersResult {
  readonly values: ReadonlyArray<EnumValueInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly isNumeric: boolean;
  readonly needsMapping: boolean;
  readonly hasError: boolean;
}

interface ConvertedMemberInfo {
  readonly convertedName: string;
  readonly member: EnumMemberInfo;
}

function convertEnumMembers(
  params: ConvertEnumMembersParams,
): ConvertEnumMembersResult {
  const { members, enumName, sourceFile, enumLocation } = params;
  const values: EnumValueInfo[] = [];
  const diagnostics: Diagnostic[] = [];
  let isNumeric = false;
  let needsMapping = false;

  const eligibleMembers: ConvertedMemberInfo[] = [];

  for (const member of members) {
    const convertedName = toScreamingSnakeCase(member.name);

    const eligibility = isEligibleAsEnumValue(convertedName, member.name);
    if (!eligibility.eligible) {
      diagnostics.push({
        code: "SKIPPED_ENUM_VALUE",
        message: eligibility.skipReason!.message,
        severity: "warning",
        location: member.sourceLocation ?? {
          file: sourceFile,
          line: 1,
          column: 1,
        },
      });
      continue;
    }

    if (member.numericValue !== null) {
      isNumeric = true;
    }

    eligibleMembers.push({ convertedName, member });
  }

  const prefixDetectionResult = detectEnumPrefix({
    enumName,
    memberValues: eligibleMembers.map((m) => m.convertedName),
  });

  const finalNameToOriginals = new Map<string, string[]>();

  for (const { convertedName, member } of eligibleMembers) {
    let finalName = convertedName;
    if (prefixDetectionResult.shouldStrip && prefixDetectionResult.prefix) {
      finalName = stripEnumPrefix(convertedName, prefixDetectionResult.prefix);
      needsMapping = true;
    } else if (convertedName !== member.value) {
      needsMapping = true;
    }

    const existingOriginals = finalNameToOriginals.get(finalName) ?? [];
    existingOriginals.push(member.value);
    finalNameToOriginals.set(finalName, existingOriginals);

    values.push({
      name: finalName,
      originalValue: member.value,
      numericValue: member.numericValue,
      description: member.description,
      deprecated: member.deprecated,
    });
  }

  let hasError = false;
  for (const [finalName, originals] of finalNameToOriginals) {
    if (originals.length > 1) {
      diagnostics.push({
        code: "DUPLICATE_ENUM_VALUE_AFTER_CONVERSION",
        message: `Enum '${enumName}' has duplicate value '${finalName}' after conversion (from '${originals.join("' and '")}')`,
        severity: "error",
        location: enumLocation,
      });
      hasError = true;
    }
  }

  return { values, diagnostics, isNumeric, needsMapping, hasError };
}

interface ConvertFieldsResult {
  readonly fields: FieldInfo[];
  readonly diagnostics: Diagnostic[];
}

function convertFields(
  extracted: ExtractedTypeInfo,
  isInput: boolean,
): ConvertFieldsResult {
  const fields: FieldInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const field of extracted.fields) {
    // Typename discrimination fields are silently excluded from the schema
    if (isTypenameFieldName(field.name)) {
      continue;
    }

    const eligibility = isEligibleField({
      fieldName: field.name,
      kind: isInput ? "input" : "object",
    });

    if (!eligibility.eligible) {
      diagnostics.push({
        code: "SKIPPED_FIELD",
        message: eligibility.skipReason!.message,
        severity: "warning",
        location: field.sourceLocation ?? {
          file: extracted.metadata.sourceFile,
          line: 1,
          column: 1,
        },
      });
      continue;
    }

    fields.push({
      name: field.name,
      type: convertTsTypeToGraphQLType(field.tsType, field.optional),
      description: field.description,
      deprecated: field.deprecated,
      directives: field.directives,
      defaultValue: field.defaultValue,
    });
  }

  return { fields, diagnostics };
}

function isValidOneOfFieldType(
  typeName: string,
  typeMap: Map<string, ExtractedTypeInfo>,
): boolean {
  if (isBuiltInScalar(typeName)) {
    return true;
  }
  if (PRIMITIVE_TYPE_MAP[typeName]) {
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
      directives: null,
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

      const enumLocation: SourceLocation = metadata.sourceLocation ?? {
        file: metadata.sourceFile,
        line: 1,
        column: 1,
      };
      const {
        values: enumValues,
        diagnostics: enumDiagnostics,
        isNumeric,
        needsMapping,
        hasError,
      } = convertEnumMembers({
        members: extracted.enumMembers ?? [],
        enumName: metadata.name,
        sourceFile: metadata.sourceFile,
        enumLocation,
      });
      diagnostics.push(...enumDiagnostics);

      if (hasError) {
        continue;
      }

      types.push({
        name: metadata.name,
        kind: "Enum",
        fields: null,
        unionMembers: null,
        enumValues,
        isNumericEnum: isNumeric,
        needsStringEnumMapping: !isNumeric && needsMapping,
        implementedInterfaces: null,
        sourceFile: metadata.sourceFile,
        description: metadata.description,
        deprecated: metadata.deprecated,
        directives: metadata.directives,
      });
    } else if (metadata.kind === "graphqlInterface") {
      const { fields, diagnostics: fieldDiagnostics } = convertFields(
        extracted,
        false,
      );
      diagnostics.push(...fieldDiagnostics);

      types.push({
        name: metadata.name,
        kind: "Interface",
        fields,
        unionMembers: null,
        enumValues: null,
        isNumericEnum: false,
        needsStringEnumMapping: false,
        implementedInterfaces: extracted.implementedInterfaces
          ? [...extracted.implementedInterfaces]
          : null,
        sourceFile: metadata.sourceFile,
        description: metadata.description,
        deprecated: metadata.deprecated,
        directives: metadata.directives,
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
              isNumericEnum: false,
              needsStringEnumMapping: false,
              implementedInterfaces: null,
              sourceFile: metadata.sourceFile,
              description: metadata.description,
              deprecated: metadata.deprecated,
              directives: metadata.directives,
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
          isNumericEnum: false,
          needsStringEnumMapping: false,
          implementedInterfaces: null,
          sourceFile: metadata.sourceFile,
          description: metadata.description,
          deprecated: null,
          directives: metadata.directives,
        });
      }
    } else {
      const isInput = isInputTypeName(metadata.name);
      const { fields, diagnostics: fieldDiagnostics } = convertFields(
        extracted,
        isInput,
      );
      diagnostics.push(...fieldDiagnostics);

      types.push({
        name: metadata.name,
        kind: isInput ? "InputObject" : "Object",
        fields,
        unionMembers: null,
        enumValues: null,
        isNumericEnum: false,
        needsStringEnumMapping: false,
        implementedInterfaces: extracted.implementedInterfaces
          ? [...extracted.implementedInterfaces]
          : null,
        sourceFile: metadata.sourceFile,
        description: metadata.description,
        deprecated: metadata.deprecated,
        directives: metadata.directives,
      });
    }
  }

  return { types, diagnostics };
}
