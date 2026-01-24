import type {
  Diagnostic,
  ExtractedTypeInfo,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type { InlineUnionMemberInfo } from "./inline-union-types.js";
import { isInputTypeName } from "./naming-convention.js";
import {
  findTypenameProperty,
  type TypenameFieldName,
} from "./typename-types.js";

export interface ValidateUnionResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface ValidateUnionMembersParams {
  readonly members: ReadonlyArray<InlineUnionMemberInfo>;
  readonly typeName: string;
  readonly sourceLocation: SourceLocation;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

/**
 * Validates that all union members are object types.
 * GraphQL unions cannot contain primitives, enums, or scalars.
 *
 * Reports:
 * - INLINE_UNION_PRIMITIVE_MEMBER for primitive types
 * - INLINE_UNION_ENUM_MEMBER for enum types
 * - INLINE_UNION_UNRESOLVABLE_MEMBER for unresolvable types
 */
export function validateUnionMembers(
  params: ValidateUnionMembersParams,
): ValidateUnionResult {
  const { members, typeName, sourceLocation, typeMap } = params;
  const diagnostics: Diagnostic[] = [];

  for (const member of members) {
    const memberType = member.memberType;
    const diagnostic = validateUnionMemberType({
      memberType,
      needsAutoGeneration: member.needsAutoGeneration,
      typeName,
      sourceLocation,
      typeMap,
    });
    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

interface ValidateMemberTypeParams {
  readonly memberType: TSTypeReference;
  readonly needsAutoGeneration: boolean;
  readonly typeName: string;
  readonly sourceLocation: SourceLocation;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

function validateUnionMemberType(
  params: ValidateMemberTypeParams,
): Diagnostic | null {
  const { memberType, needsAutoGeneration, typeName, sourceLocation, typeMap } =
    params;

  if (memberType.kind === "primitive") {
    return {
      code: "INLINE_UNION_PRIMITIVE_MEMBER",
      message: `Inline union '${typeName}' contains primitive type '${memberType.name}'. GraphQL unions can only contain object types.`,
      severity: "error",
      location: sourceLocation,
    };
  }

  if (memberType.kind === "inlineEnum") {
    return {
      code: "INLINE_UNION_ENUM_MEMBER",
      message: `Inline union '${typeName}' contains an enum type. GraphQL unions can only contain object types.`,
      severity: "error",
      location: sourceLocation,
    };
  }

  if (memberType.kind === "literal") {
    return {
      code: "INLINE_UNION_ENUM_MEMBER",
      message: `Inline union '${typeName}' contains a literal type '${memberType.name}'. GraphQL unions can only contain object types.`,
      severity: "error",
      location: sourceLocation,
    };
  }

  if (memberType.kind === "scalar") {
    return {
      code: "INLINE_UNION_UNRESOLVABLE_MEMBER",
      message: `Inline union '${typeName}' contains scalar type '${memberType.scalarInfo?.scalarName ?? memberType.name}'. GraphQL unions can only contain object types.`,
      severity: "error",
      location: sourceLocation,
    };
  }

  if (memberType.kind === "reference" && memberType.name !== null) {
    const referencedType = typeMap.get(memberType.name);

    if (referencedType?.metadata.kind === "enum") {
      return {
        code: "INLINE_UNION_ENUM_MEMBER",
        message: `Inline union '${typeName}' contains enum type '${memberType.name}'. GraphQL unions can only contain object types.`,
        severity: "error",
        location: sourceLocation,
      };
    }

    if (!referencedType && needsAutoGeneration) {
      return {
        code: "INLINE_UNION_UNRESOLVABLE_MEMBER",
        message: `Inline union '${typeName}' contains unresolvable type '${memberType.name}'. The type cannot be expanded as an object type.`,
        severity: "error",
        location: sourceLocation,
      };
    }
  }

  if (
    memberType.kind === "inlineObject" ||
    memberType.kind === "reference" ||
    memberType.kind === "union"
  ) {
    return null;
  }

  return {
    code: "INLINE_UNION_UNRESOLVABLE_MEMBER",
    message: `Inline union '${typeName}' contains a type that cannot be resolved as an object type.`,
    severity: "error",
    location: sourceLocation,
  };
}

export interface ValidateOneOfMembersParams {
  readonly members: ReadonlyArray<InlineUnionMemberInfo>;
  readonly typeName: string;
  readonly sourceLocation: SourceLocation;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

/**
 * Validates @oneOf input object constraints:
 * - Each member must have exactly one property
 * - Property names must be unique across all members
 * - Field types must be scalar, enum, or input object
 *
 * Reports:
 * - ONEOF_EMPTY_OBJECT for empty object members
 * - ONEOF_MULTIPLE_PROPERTIES for members with multiple properties
 * - ONEOF_DUPLICATE_PROPERTY for duplicate property names
 * - ONEOF_INVALID_FIELD_TYPE for invalid field types
 */
export function validateOneOfMembers(
  params: ValidateOneOfMembersParams,
): ValidateUnionResult {
  const { members, typeName, sourceLocation, typeMap } = params;
  const diagnostics: Diagnostic[] = [];
  const seenPropertyNames = new Set<string>();

  for (let i = 0; i < members.length; i++) {
    const member = members[i]!;
    const memberType = member.memberType;

    if (memberType.kind === "reference") {
      continue;
    }

    if (
      memberType.kind !== "inlineObject" ||
      !memberType.inlineObjectProperties
    ) {
      continue;
    }

    const properties = memberType.inlineObjectProperties;

    if (properties.length === 0) {
      diagnostics.push({
        code: "ONEOF_EMPTY_OBJECT",
        message: `OneOf input '${typeName}' member at index ${i} is an empty object. Each member must have exactly one property.`,
        severity: "error",
        location: sourceLocation,
      });
      continue;
    }

    if (properties.length > 1) {
      diagnostics.push({
        code: "ONEOF_MULTIPLE_PROPERTIES",
        message: `OneOf input '${typeName}' member at index ${i} has ${properties.length} properties. Each member must have exactly one property.`,
        severity: "error",
        location: sourceLocation,
      });
      continue;
    }

    const prop = properties[0]!;

    if (seenPropertyNames.has(prop.name)) {
      diagnostics.push({
        code: "ONEOF_DUPLICATE_PROPERTY",
        message: `OneOf input '${typeName}' has duplicate property name '${prop.name}'.`,
        severity: "error",
        location: sourceLocation,
      });
      continue;
    }
    seenPropertyNames.add(prop.name);

    const fieldTypeError = validateOneOfFieldType({
      propertyName: prop.name,
      propertyType: prop.tsType,
      typeName,
      sourceLocation,
      typeMap,
    });
    if (fieldTypeError) {
      diagnostics.push(fieldTypeError);
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

interface ValidateOneOfFieldTypeParams {
  readonly propertyName: string;
  readonly propertyType: TSTypeReference;
  readonly typeName: string;
  readonly sourceLocation: SourceLocation;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

function validateOneOfFieldType(
  params: ValidateOneOfFieldTypeParams,
): Diagnostic | null {
  const { propertyName, propertyType, typeName, sourceLocation, typeMap } =
    params;

  if (
    propertyType.kind === "primitive" ||
    propertyType.kind === "scalar" ||
    propertyType.kind === "inlineEnum"
  ) {
    return null;
  }

  if (propertyType.kind === "inlineObject") {
    return null;
  }

  if (propertyType.kind === "reference" && propertyType.name !== null) {
    const referencedType = typeMap.get(propertyType.name);

    if (!referencedType) {
      return null;
    }

    const isValidType =
      referencedType.metadata.kind === "enum" ||
      isInputTypeName(referencedType.metadata.name);

    if (isValidType) {
      return null;
    }

    return {
      code: "ONEOF_INVALID_FIELD_TYPE",
      message: `OneOf input '${typeName}' field '${propertyName}' has invalid type '${propertyType.name}'. Only scalar types, enum types, and Input Object types are allowed.`,
      severity: "error",
      location: sourceLocation,
    };
  }

  return null;
}

export interface ValidateUnionMemberTypenamesParams {
  readonly members: ReadonlyArray<InlineUnionMemberInfo>;
  readonly unionTypeName: string;
  readonly sourceLocation: SourceLocation;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

export interface ValidatedTypenameInfo {
  readonly typeName: string;
  readonly fieldName: TypenameFieldName;
}

export interface ValidateUnionMemberTypenamesResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly memberTypenames: ReadonlyMap<number, ValidatedTypenameInfo>;
  readonly allMembersHaveTypename: boolean;
}

/**
 * Validates __typename or $typeName property on inline union members.
 * Returns extracted typename values for valid members.
 *
 * Behavior:
 * - For named types (needsAutoGeneration: false), extracts typename from typeMap
 * - For inline types (needsAutoGeneration: true), validates and extracts typename
 * - Only called for payload unions (context.kind === "resolverPayload")
 * - __typename takes priority over $typeName if both are present
 *
 * Reports:
 * - MISSING_TYPENAME_PROPERTY when neither __typename nor $typeName is present
 * - INVALID_TYPENAME_TYPE when the property is not a string literal
 * - OPTIONAL_TYPENAME_PROPERTY when the property is declared as optional
 * - NULLABLE_TYPENAME_PROPERTY when the property is nullable
 */
export function validateUnionMemberTypenames(
  params: ValidateUnionMemberTypenamesParams,
): ValidateUnionMemberTypenamesResult {
  const { members, unionTypeName, sourceLocation, typeMap } = params;
  const diagnostics: Diagnostic[] = [];
  const memberTypenames = new Map<number, ValidatedTypenameInfo>();

  let inlineTypeCount = 0;
  let inlineTypesWithTypename = 0;
  let namedTypeCount = 0;
  let namedTypesWithTypename = 0;

  for (let i = 0; i < members.length; i++) {
    const member = members[i]!;
    const memberType = member.memberType;

    if (!member.needsAutoGeneration) {
      namedTypeCount++;
      if (memberType.kind === "reference" && memberType.name !== null) {
        const referencedType = typeMap.get(memberType.name);
        if (referencedType) {
          const found = findTypenameProperty(
            referencedType.fields,
            (f) => f.name,
          );
          if (found) {
            const field = found.property;
            const { tsType } = field;
            if (
              !field.optional &&
              !tsType.nullable &&
              tsType.kind === "literal" &&
              tsType.name !== null
            ) {
              memberTypenames.set(i, {
                typeName: tsType.name,
                fieldName: found.fieldName,
              });
              namedTypesWithTypename++;
            }
          }
        }
      }
      continue;
    }

    if (
      memberType.kind !== "inlineObject" ||
      !memberType.inlineObjectProperties
    ) {
      continue;
    }

    inlineTypeCount++;

    const found = findTypenameProperty(
      memberType.inlineObjectProperties,
      (prop) => prop.name,
    );

    if (!found) {
      diagnostics.push({
        code: "MISSING_TYPENAME_PROPERTY",
        message: `Union '${unionTypeName}' member at index ${i} is missing '__typename' or '$typeName' property. Inline union members must have a '__typename' or '$typeName' property with a string literal type.`,
        severity: "error",
        location: sourceLocation,
      });
      continue;
    }

    const { property: selectedProperty, fieldName: selectedFieldName } = found;
    const typenameType = selectedProperty.tsType;

    if (selectedProperty.optional) {
      diagnostics.push({
        code: "OPTIONAL_TYPENAME_PROPERTY",
        message: `Union '${unionTypeName}' member at index ${i} has optional '${selectedFieldName}' property. The '${selectedFieldName}' property must be required for union type resolution.`,
        severity: "error",
        location: sourceLocation,
      });
    }

    if (typenameType.nullable) {
      diagnostics.push({
        code: "NULLABLE_TYPENAME_PROPERTY",
        message: `Union '${unionTypeName}' member at index ${i} has nullable '${selectedFieldName}' property. The '${selectedFieldName}' property must not be nullable for union type resolution.`,
        severity: "error",
        location: sourceLocation,
      });
    }

    if (typenameType.kind !== "literal" || typenameType.name === null) {
      diagnostics.push({
        code: "INVALID_TYPENAME_TYPE",
        message: `Union '${unionTypeName}' member at index ${i} has '${selectedFieldName}' that is not a string literal type. Expected a string literal like '${selectedFieldName}: "TypeName"'.`,
        severity: "error",
        location: sourceLocation,
      });
      continue;
    }

    if (!selectedProperty.optional && !typenameType.nullable) {
      memberTypenames.set(i, {
        typeName: typenameType.name,
        fieldName: selectedFieldName,
      });
      inlineTypesWithTypename++;
    }
  }

  // Determine allMembersHaveTypename based on member composition:
  // - If there are inline types: only inline types need typename (original behavior)
  // - If all members are named types: all named types need typename (new behavior for issue #116)
  let allMembersHaveTypename: boolean;
  if (inlineTypeCount > 0) {
    allMembersHaveTypename = inlineTypesWithTypename === inlineTypeCount;
  } else {
    allMembersHaveTypename =
      namedTypeCount > 0 && namedTypesWithTypename === namedTypeCount;
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
    memberTypenames,
    allMembersHaveTypename,
  };
}
