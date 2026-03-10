import type { ResolvedDiscriminatorFieldsMap } from "../config-loader/index.js";
import type {
  Diagnostic,
  ExtractedTypeInfo,
  FieldDefinition,
  InlineObjectMember,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type { ValidatedDiscriminatorEntry } from "./discriminator-resolve-type-generator.js";

export interface ValidateDiscriminatorFieldsParams {
  readonly discriminatorFields: ResolvedDiscriminatorFieldsMap;
  readonly extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
  /** Union names already handled by inline union flattening (skip DISCRIMINATOR_UNKNOWN_UNION) */
  readonly inlineDiscriminatorUnionNames: ReadonlySet<string>;
}

export interface ValidateDiscriminatorFieldsResult {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly validatedEntries: ReadonlyArray<ValidatedDiscriminatorEntry>;
}

/** Identifier used for each member when collecting value tuples. */
interface MemberIdentifier {
  readonly label: string;
}

function findFieldInNamedMember(
  memberType: ExtractedTypeInfo,
  fieldName: string,
): FieldDefinition | null {
  for (const field of memberType.fields) {
    if (field.name === fieldName) {
      return field;
    }
  }
  return null;
}

function findFieldInInlineMember(
  inlineMember: InlineObjectMember,
  fieldName: string,
): TSTypeReference | null {
  for (const prop of inlineMember.properties) {
    if (prop.propertyName === fieldName) {
      return prop.propertyType;
    }
  }
  return null;
}

/** Extract a string literal value from a TSTypeReference, or null if not a string literal. */
function getStringLiteralValue(tsType: TSTypeReference): string | null {
  if (tsType.kind === "stringLiteral" && tsType.name !== null) {
    return tsType.name;
  }
  return null;
}

/**
 * Validates primary (first) discriminator field for a named member.
 * Returns the string literal value if valid, or null if an error was reported.
 */
function validatePrimaryFieldForNamedMember(
  memberType: ExtractedTypeInfo,
  primaryFieldName: string,
  unionTypeName: string,
  memberName: string,
  sourceLocation: SourceLocation,
  diagnostics: Diagnostic[],
): string | null {
  const field = findFieldInNamedMember(memberType, primaryFieldName);
  if (field === null) {
    diagnostics.push({
      code: "DISCRIMINATOR_FIELD_NOT_FOUND",
      message: `Union '${unionTypeName}' member '${memberName}' does not have discriminator field '${primaryFieldName}'.`,
      severity: "error",
      location: sourceLocation,
    });
    return null;
  }

  const value = getStringLiteralValue(field.tsType);
  if (value === null) {
    diagnostics.push({
      code: "DISCRIMINATOR_FIELD_NOT_STRING_LITERAL",
      message: `Union '${unionTypeName}' member '${memberName}' has discriminator field '${primaryFieldName}' but its type is not a string literal.`,
      severity: "error",
      location: sourceLocation,
    });
    return null;
  }

  return value;
}

/**
 * Validates primary (first) discriminator field for an inline object member.
 * Returns the string literal value if valid, or null if an error was reported.
 */
function validatePrimaryFieldForInlineMember(
  inlineMember: InlineObjectMember,
  primaryFieldName: string,
  unionTypeName: string,
  memberIndex: number,
  sourceLocation: SourceLocation,
  diagnostics: Diagnostic[],
): string | null {
  const tsType = findFieldInInlineMember(inlineMember, primaryFieldName);
  if (tsType === null) {
    diagnostics.push({
      code: "DISCRIMINATOR_FIELD_NOT_FOUND",
      message: `Union '${unionTypeName}' member at index ${memberIndex} does not have discriminator field '${primaryFieldName}'.`,
      severity: "error",
      location: sourceLocation,
    });
    return null;
  }

  const value = getStringLiteralValue(tsType);
  if (value === null) {
    diagnostics.push({
      code: "DISCRIMINATOR_FIELD_NOT_STRING_LITERAL",
      message: `Union '${unionTypeName}' member at index ${memberIndex} has discriminator field '${primaryFieldName}' but its type is not a string literal.`,
      severity: "error",
      location: sourceLocation,
    });
    return null;
  }

  return value;
}

/**
 * Collects secondary (2nd+) discriminator field values for a named member.
 * Secondary fields are optional -- returns null for absent fields.
 */
function collectSecondaryValuesForNamedMember(
  memberType: ExtractedTypeInfo,
  secondaryFieldNames: ReadonlyArray<string>,
): ReadonlyArray<string | null> {
  return secondaryFieldNames.map((fieldName) => {
    const field = findFieldInNamedMember(memberType, fieldName);
    if (field === null) {
      return null;
    }
    return getStringLiteralValue(field.tsType);
  });
}

/**
 * Collects secondary (2nd+) discriminator field values for an inline object member.
 * Secondary fields are optional -- returns null for absent fields.
 */
function collectSecondaryValuesForInlineMember(
  inlineMember: InlineObjectMember,
  secondaryFieldNames: ReadonlyArray<string>,
): ReadonlyArray<string | null> {
  return secondaryFieldNames.map((fieldName) => {
    const tsType = findFieldInInlineMember(inlineMember, fieldName);
    if (tsType === null) {
      return null;
    }
    return getStringLiteralValue(tsType);
  });
}

/**
 * Checks that all member value tuples are unique. Reports DISCRIMINATOR_DUPLICATE_VALUE_TUPLE
 * for any duplicates found.
 */
/**
 * Returns true if duplicates were found (diagnostics were added).
 */
function validateValueTupleUniqueness(
  memberTuples: ReadonlyArray<{
    readonly id: MemberIdentifier;
    readonly values: ReadonlyArray<string | null>;
  }>,
  unionTypeName: string,
  sourceLocation: SourceLocation,
  diagnostics: Diagnostic[],
): boolean {
  // Group members by their serialized value tuple
  const tupleGroups = new Map<string, string[]>();
  for (const { id, values } of memberTuples) {
    const key = JSON.stringify(values);
    let group = tupleGroups.get(key);
    if (group === undefined) {
      group = [];
      tupleGroups.set(key, group);
    }
    group.push(id.label);
  }

  let hasDuplicates = false;
  for (const [tupleKey, members] of tupleGroups) {
    if (members.length > 1) {
      hasDuplicates = true;
      const tupleDisplay = tupleKey;
      diagnostics.push({
        code: "DISCRIMINATOR_DUPLICATE_VALUE_TUPLE",
        message: `Union '${unionTypeName}' has duplicate discriminator value tuple ${tupleDisplay} for members ${members.map((m) => `'${m}'`).join(", ")}.`,
        severity: "error",
        location: sourceLocation,
      });
    }
  }
  return hasDuplicates;
}

/**
 * Validates that the primary (first) discriminator field exists on all union members
 * and has a string literal type value. Also validates that the value tuples
 * (primary + secondary field values) are unique across all members.
 *
 * Reports diagnostics for:
 * - DISCRIMINATOR_FIELD_NOT_FOUND: field does not exist on a member
 * - DISCRIMINATOR_FIELD_NOT_STRING_LITERAL: field exists but is not a string literal type
 * - DISCRIMINATOR_DUPLICATE_VALUE_TUPLE: value tuples are not unique across members
 */
export function validateDiscriminatorFields(
  params: ValidateDiscriminatorFieldsParams,
): ValidateDiscriminatorFieldsResult {
  const { discriminatorFields, typeMap, inlineDiscriminatorUnionNames } =
    params;
  const diagnostics: Diagnostic[] = [];
  const validatedEntries: ValidatedDiscriminatorEntry[] = [];

  for (const [unionTypeName, fieldNames] of discriminatorFields) {
    const unionType = typeMap.get(unionTypeName);
    if (unionType === undefined) {
      // Skip warning for unions already handled by inline union flattening
      if (!inlineDiscriminatorUnionNames.has(unionTypeName)) {
        diagnostics.push({
          code: "DISCRIMINATOR_UNKNOWN_UNION",
          message: `Union type '${unionTypeName}' specified in discriminatorFields does not exist.`,
          severity: "warning",
          location: null,
        });
      }
      continue;
    }

    if (unionType.metadata.kind !== "union") {
      continue;
    }

    const primaryFieldName = fieldNames[0];
    if (primaryFieldName === undefined) {
      continue;
    }

    const sourceLocation = unionType.metadata.sourceLocation;
    const secondaryFieldNames = fieldNames.slice(1);

    // Track whether any primary field errors were found for this union.
    // If so, skip the value tuple uniqueness check since tuples would be incomplete.
    let hasPrimaryErrors = false;

    // Collect value tuples for all members (used for both validation and output)
    const memberTuples: {
      readonly id: MemberIdentifier;
      readonly values: ReadonlyArray<string | null>;
      readonly memberTypeName: string | null;
      readonly memberIndex: number;
      readonly isInlineObject: boolean;
    }[] = [];

    // Validate named members
    const namedMembers = unionType.unionMembers ?? [];
    for (let memberIdx = 0; memberIdx < namedMembers.length; memberIdx++) {
      const memberName = namedMembers[memberIdx]!;
      const memberType = typeMap.get(memberName);
      if (memberType === undefined) {
        continue;
      }

      const primaryValue = validatePrimaryFieldForNamedMember(
        memberType,
        primaryFieldName,
        unionTypeName,
        memberName,
        sourceLocation,
        diagnostics,
      );

      if (primaryValue === null) {
        hasPrimaryErrors = true;
        continue;
      }

      const secondaryValues = collectSecondaryValuesForNamedMember(
        memberType,
        secondaryFieldNames,
      );
      memberTuples.push({
        id: { label: memberName },
        values: [primaryValue, ...secondaryValues],
        memberTypeName: memberName,
        memberIndex: memberIdx,
        isInlineObject: false,
      });
    }

    // Validate inline object members
    const inlineObjectMembers = unionType.inlineObjectMembers ?? [];
    const namedMemberCount = namedMembers.length;
    for (let i = 0; i < inlineObjectMembers.length; i++) {
      const inlineMember = inlineObjectMembers[i]!;
      const memberIndex = namedMemberCount + i;

      const primaryValue = validatePrimaryFieldForInlineMember(
        inlineMember,
        primaryFieldName,
        unionTypeName,
        memberIndex,
        sourceLocation,
        diagnostics,
      );

      if (primaryValue === null) {
        hasPrimaryErrors = true;
        continue;
      }

      const secondaryValues = collectSecondaryValuesForInlineMember(
        inlineMember,
        secondaryFieldNames,
      );
      memberTuples.push({
        id: { label: `member${memberIndex}` },
        values: [primaryValue, ...secondaryValues],
        memberTypeName: null,
        memberIndex,
        isInlineObject: true,
      });
    }

    // Only check uniqueness when all primary fields are valid
    if (!hasPrimaryErrors && memberTuples.length > 0) {
      const hasDuplicateErrors = validateValueTupleUniqueness(
        memberTuples,
        unionTypeName,
        sourceLocation,
        diagnostics,
      );

      // Only produce validated entries when validation passed (no primary errors, no duplicates)
      if (!hasDuplicateErrors) {
        validatedEntries.push({
          unionTypeName,
          fieldNames: [...fieldNames],
          memberValueTuples: memberTuples.map((t) => ({
            memberTypeName: t.memberTypeName,
            memberIndex: t.memberIndex,
            values: t.values,
            isInlineObject: t.isInlineObject,
          })),
        });
      }
    }
  }

  return { diagnostics, validatedEntries };
}
