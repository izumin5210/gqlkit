import type {
  Diagnostic,
  InlineObjectMember,
  SourceLocation,
  TypenameFieldName,
} from "../core/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import type { TypenameExtractionResult } from "./typename-extractor.js";
import { findTypenameProperty } from "./typename-types.js";

export interface ValidateTypenamesParams {
  readonly extractionResult: TypenameExtractionResult;
  readonly sourceLocation: SourceLocation;
  readonly inlineObjectMembers: ReadonlyArray<InlineObjectMember> | null;
}

export interface ValidateTypenamesResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface ValidateSchemaTypenamesParams {
  readonly objectTypes: ReadonlyArray<ExtractedTypeInfo>;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

export interface ValidateSchemaTypenamesResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

interface TypenameValueInfo {
  readonly memberTypeName: string;
  readonly fieldName: TypenameFieldName;
}

function getAbstractTypeLabel(kind: "union" | "interface"): string {
  return kind === "union" ? "Union" : "Interface";
}

function getMemberLabel(kind: "union" | "interface"): string {
  return kind === "union" ? "members" : "implementers";
}

interface InlineObjectTypenameAnalysis {
  readonly exists: boolean;
  readonly fieldName: TypenameFieldName | null;
  readonly isStringLiteral: boolean;
  readonly isNullable: boolean;
}

function analyzeInlineObjectTypename(
  inlineObjectMember: InlineObjectMember,
): InlineObjectTypenameAnalysis {
  const found = findTypenameProperty(
    inlineObjectMember.properties,
    (p) => p.propertyName,
  );

  if (!found) {
    return {
      exists: false,
      fieldName: null,
      isStringLiteral: false,
      isNullable: false,
    };
  }

  const { property, fieldName } = found;
  const { propertyType: tsType } = property;

  return {
    exists: true,
    fieldName,
    isStringLiteral: tsType.kind === "stringLiteral" && tsType.name !== null,
    isNullable: tsType.nullable,
  };
}

function validateInlineObjectsTypenames(
  extractionResult: TypenameExtractionResult,
  inlineObjectMembers: ReadonlyArray<InlineObjectMember>,
  sourceLocation: SourceLocation,
): Diagnostic[] {
  if (!extractionResult.hasInlineObjects) {
    return [];
  }

  if (extractionResult.abstractTypeName.endsWith("Input")) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  const abstractTypeName = extractionResult.abstractTypeName;
  const abstractTypeLabel = getAbstractTypeLabel(
    extractionResult.abstractTypeKind,
  );

  const namedMemberCount = extractionResult.members.filter(
    (m) => !m.isInlineObject,
  ).length;

  for (const member of extractionResult.members) {
    if (member.isInlineObject) {
      const inlineIndex = member.memberIndex - namedMemberCount;
      const inlineObjectMember = inlineObjectMembers[inlineIndex];

      if (inlineObjectMember) {
        const analysis = analyzeInlineObjectTypename(inlineObjectMember);

        if (!analysis.exists) {
          diagnostics.push({
            code: "MISSING_TYPENAME_PROPERTY",
            message: `${abstractTypeLabel} '${abstractTypeName}' member at index ${member.memberIndex} is missing '__typename' or '$typeName' property. When a union contains inline objects, all members must have a typename property.`,
            severity: "error",
            location: sourceLocation,
          });
        } else if (!analysis.isStringLiteral) {
          diagnostics.push({
            code: "INVALID_TYPENAME_TYPE",
            message: `${abstractTypeLabel} '${abstractTypeName}' member at index ${member.memberIndex} has '${analysis.fieldName}' that is not a string literal type. Expected a string literal like '__typename: "TypeName"'.`,
            severity: "error",
            location: sourceLocation,
          });
        } else if (analysis.isNullable) {
          diagnostics.push({
            code: "NULLABLE_TYPENAME_PROPERTY",
            message: `${abstractTypeLabel} '${abstractTypeName}' member at index ${member.memberIndex} has nullable '${analysis.fieldName}' property. The typename property must not be nullable.`,
            severity: "error",
            location: sourceLocation,
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Validates typename fields within an abstract type.
 * Reports errors for:
 * - DUPLICATE_TYPENAME_VALUE: Multiple members have the same typename value
 * - MISSING_TYPENAME_PROPERTY: Inline objects without typename (when union has inline objects)
 * - INVALID_TYPENAME_TYPE: Typename is not a string literal type
 * - NULLABLE_TYPENAME_PROPERTY: Typename is nullable
 */
export function validateTypenames(
  params: ValidateTypenamesParams,
): ValidateTypenamesResult {
  const { extractionResult, sourceLocation, inlineObjectMembers } = params;
  const diagnostics: Diagnostic[] = [];

  if (inlineObjectMembers) {
    const inlineValidationDiagnostics = validateInlineObjectsTypenames(
      extractionResult,
      inlineObjectMembers,
      sourceLocation,
    );
    diagnostics.push(...inlineValidationDiagnostics);
  }

  const typenameValueToMembers = new Map<string, TypenameValueInfo[]>();

  for (const member of extractionResult.members) {
    if (member.typenameInfo === null) {
      continue;
    }

    const { typeName, fieldName } = member.typenameInfo;
    const memberTypeName =
      member.memberTypeName ??
      `(anonymous member at index ${member.memberIndex})`;

    const existing = typenameValueToMembers.get(typeName) ?? [];
    existing.push({ memberTypeName, fieldName });
    typenameValueToMembers.set(typeName, existing);
  }

  const abstractTypeLabel = getAbstractTypeLabel(
    extractionResult.abstractTypeKind,
  );
  const memberLabel = getMemberLabel(extractionResult.abstractTypeKind);

  for (const [typenameValue, members] of typenameValueToMembers) {
    if (members.length > 1) {
      const allSameFieldName = members.every(
        (m) => m.fieldName === members[0]!.fieldName,
      );

      let message: string;
      if (allSameFieldName) {
        const memberNames = members
          .map((m) => `'${m.memberTypeName}'`)
          .join(" and ");
        message = `Duplicate typename value '${typenameValue}' in ${abstractTypeLabel} '${extractionResult.abstractTypeName}': used by ${memberLabel} ${memberNames}.`;
      } else {
        const memberDescriptions = members
          .map((m) => `member '${m.memberTypeName}' (${m.fieldName})`)
          .join(" and ");
        message = `Duplicate typename value '${typenameValue}' in ${abstractTypeLabel} '${extractionResult.abstractTypeName}': ${memberDescriptions} have the same value.`;
      }

      diagnostics.push({
        code: "DUPLICATE_TYPENAME_VALUE",
        message,
        severity: "error",
        location: sourceLocation,
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

interface ObjectTypeTypenameInfo {
  readonly typeName: string;
  readonly typenameValue: string;
  readonly fieldName: TypenameFieldName;
  readonly sourceLocation: SourceLocation;
}

function extractTypenameFromObjectType(
  typeInfo: ExtractedTypeInfo,
): ObjectTypeTypenameInfo | null {
  const found = findTypenameProperty(typeInfo.fields, (f) => f.name);
  if (!found) {
    return null;
  }

  const { property: field, fieldName } = found;
  const { tsType } = field;

  if (
    field.optional ||
    tsType.nullable ||
    tsType.kind !== "stringLiteral" ||
    tsType.name === null
  ) {
    return null;
  }

  return {
    typeName: typeInfo.metadata.name,
    typenameValue: tsType.name,
    fieldName,
    sourceLocation: typeInfo.metadata.sourceLocation,
  };
}

/**
 * Validates that there are no duplicate typename values across the entire schema.
 * Reports DUPLICATE_TYPENAME_VALUE error when:
 * - Different object types have the same __typename value (Requirement 4.7)
 * - Different object types have the same $typeName value (Requirement 4.8)
 * - An object's __typename equals another object's $typeName (Requirement 4.9)
 */
export function validateSchemaTypenames(
  params: ValidateSchemaTypenamesParams,
): ValidateSchemaTypenamesResult {
  const { objectTypes } = params;
  const diagnostics: Diagnostic[] = [];

  const typenameValueToTypes = new Map<string, ObjectTypeTypenameInfo[]>();

  for (const typeInfo of objectTypes) {
    if (
      typeInfo.metadata.kind !== "object" &&
      typeInfo.metadata.kind !== "interface" &&
      typeInfo.metadata.kind !== "graphqlInterface"
    ) {
      continue;
    }

    const typenameInfo = extractTypenameFromObjectType(typeInfo);
    if (typenameInfo === null) {
      continue;
    }

    const existing = typenameValueToTypes.get(typenameInfo.typenameValue) ?? [];
    existing.push(typenameInfo);
    typenameValueToTypes.set(typenameInfo.typenameValue, existing);
  }

  for (const [typenameValue, types] of typenameValueToTypes) {
    if (types.length > 1) {
      const allSameFieldName = types.every(
        (t) => t.fieldName === types[0]!.fieldName,
      );

      const sortedTypes = [...types].sort((a, b) =>
        a.typeName.localeCompare(b.typeName),
      );

      let message: string;
      if (allSameFieldName) {
        const typeNames = sortedTypes
          .map((t) => `'${t.typeName}'`)
          .join(" and ");
        message = `Duplicate typename value '${typenameValue}' in schema: types ${typeNames} have the same ${sortedTypes[0]!.fieldName} value.`;
      } else {
        const typeDescriptions = sortedTypes
          .map((t) => `'${t.typeName}' (${t.fieldName})`)
          .join(" and ");
        message = `Duplicate typename value '${typenameValue}' in schema: types ${typeDescriptions} have the same value.`;
      }

      const firstType = sortedTypes[1]!;
      diagnostics.push({
        code: "DUPLICATE_TYPENAME_VALUE",
        message,
        severity: "error",
        location: firstType.sourceLocation,
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}
