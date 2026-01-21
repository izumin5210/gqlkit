import type {
  Diagnostic,
  ExtractedTypeInfo,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type { InlineUnionMemberInfo } from "./inline-union-types.js";

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
 * Task 3.1: GraphQL Union type validation
 * - All union members must be object types
 * - Reports INLINE_UNION_PRIMITIVE_MEMBER for primitive types
 * - Reports INLINE_UNION_ENUM_MEMBER for enum types
 * - Reports INLINE_UNION_UNRESOLVABLE_MEMBER for unresolvable types
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
 * Task 3.2: @oneOf Input Object validation
 * - Reports ONEOF_EMPTY_OBJECT for empty object members
 * - Reports ONEOF_MULTIPLE_PROPERTIES for members with multiple properties
 * - Reports ONEOF_DUPLICATE_PROPERTY for duplicate property names
 * - Reports ONEOF_INVALID_FIELD_TYPE for invalid field types
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

function isInputTypeName(name: string): boolean {
  return name.endsWith("Input");
}
