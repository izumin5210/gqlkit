import type { ResolvedDiscriminatorFieldsMap } from "../config-loader/index.js";
import type {
  ExtractedTypeInfo,
  InlineObjectMember,
  InlineObjectProperty,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import { createPrimitiveType } from "../type-extractor/types/ts-type-reference-factory.js";

interface PropertyContribution {
  readonly property: InlineObjectProperty;
  readonly isNever: boolean;
}

/**
 * Checks whether a type reference represents an absent/impossible value.
 * This includes explicit `never` types and `undefined` references
 * (from `field?: never` where TypeScript resolves to undefined).
 */
function isAbsentType(tsType: TSTypeReference): boolean {
  if (tsType.kind === "never") {
    return true;
  }
  if (tsType.kind === "reference" && tsType.name === "undefined") {
    return true;
  }
  return false;
}

/**
 * Extracts a string literal value from a discriminator field property.
 * Returns null if the property is not a string literal.
 */
function getDiscriminatorValue(
  member: InlineObjectMember,
  fieldName: string,
): string | null {
  for (const prop of member.properties) {
    if (prop.propertyName === fieldName) {
      if (
        prop.propertyType.kind === "stringLiteral" &&
        prop.propertyType.name !== null
      ) {
        return prop.propertyType.name;
      }
      return null;
    }
  }
  return null;
}

/**
 * Checks whether two TSTypeReference values represent the same type
 * (ignoring nullability).
 */
function isSameTypeIgnoringNullability(
  a: TSTypeReference,
  b: TSTypeReference,
): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.name !== b.name) {
    return false;
  }
  if (a.kind === "array" && b.kind === "array") {
    if (a.elementType === null || b.elementType === null) {
      return a.elementType === b.elementType;
    }
    return isSameTypeIgnoringNullability(a.elementType, b.elementType);
  }
  return true;
}

/**
 * Merges properties from a group of inline object members that share the same
 * discriminator value. Handles partial presence, type widening, and never types.
 */
function mergeGroupProperties(
  group: ReadonlyArray<InlineObjectMember>,
  discriminatorFieldNames: ReadonlyArray<string>,
): ReadonlyArray<InlineObjectProperty> {
  const discriminatorFieldSet = new Set(discriminatorFieldNames);

  // Collect all property names across the group
  const allPropertyNames = new Set<string>();
  for (const member of group) {
    for (const prop of member.properties) {
      allPropertyNames.add(prop.propertyName);
    }
  }

  const mergedProperties: InlineObjectProperty[] = [];

  for (const propName of allPropertyNames) {
    // Collect contributions from each member
    const contributions: PropertyContribution[] = [];
    for (const member of group) {
      const prop = member.properties.find((p) => p.propertyName === propName);
      if (prop !== undefined) {
        contributions.push({
          property: prop,
          isNever: isAbsentType(prop.propertyType),
        });
      }
    }

    // Skip properties that are never in ALL members
    const nonNeverContributions = contributions.filter((c) => !c.isNever);
    if (nonNeverContributions.length === 0) {
      continue;
    }

    const presentInAllMembers = nonNeverContributions.length === group.length;
    const firstContribution = nonNeverContributions[0]!;

    // Check if all non-never contributions have the same type
    let allSameType = true;
    for (let i = 1; i < nonNeverContributions.length; i++) {
      if (
        !isSameTypeIgnoringNullability(
          firstContribution.property.propertyType,
          nonNeverContributions[i]!.property.propertyType,
        )
      ) {
        allSameType = false;
        break;
      }
    }

    // Discriminator fields: keep original string literal value (all members in a group
    // share the same discriminator value since that's the grouping key)
    if (discriminatorFieldSet.has(propName)) {
      mergedProperties.push({
        propertyName: propName,
        propertyType: firstContribution.property.propertyType,
        description: firstContribution.property.description,
        deprecated: firstContribution.property.deprecated,
      });
      continue;
    }

    if (allSameType) {
      // Same type across all contributing members
      const anyNullable = nonNeverContributions.some(
        (c) => c.property.propertyType.nullable,
      );
      const needsNullable = !presentInAllMembers || anyNullable;
      const baseType = firstContribution.property.propertyType;
      mergedProperties.push({
        propertyName: propName,
        propertyType:
          needsNullable && !baseType.nullable
            ? { ...baseType, nullable: true }
            : baseType,
        description: firstContribution.property.description,
        deprecated: firstContribution.property.deprecated,
      });
    } else {
      // Different types → widen to String
      const needsNullable = !presentInAllMembers;
      mergedProperties.push({
        propertyName: propName,
        propertyType: createPrimitiveType({
          name: "string",
          nullable: needsNullable,
        }),
        description: null,
        deprecated: null,
      });
    }
  }

  return mergedProperties;
}

export interface FlattenIntersectionMembersParams {
  readonly extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  readonly discriminatorFields: ResolvedDiscriminatorFieldsMap;
}

/**
 * Flattens inline object members of union types that have discriminator field config.
 * Groups members by their discriminator value tuples and merges properties within each group.
 *
 * This resolves the issue where TypeScript distributes intersections over unions,
 * creating many anonymous inline objects that would cause DISCRIMINATOR_DUPLICATE_VALUE_TUPLE
 * errors.
 */
export function flattenIntersectionMembers(
  params: FlattenIntersectionMembersParams,
): ReadonlyArray<ExtractedTypeInfo> {
  const { extractedTypes, discriminatorFields } = params;

  if (discriminatorFields.size === 0) {
    return extractedTypes;
  }

  return extractedTypes.map((typeInfo) => {
    if (typeInfo.metadata.kind !== "union") {
      return typeInfo;
    }

    const fieldNames = discriminatorFields.get(typeInfo.metadata.name);
    if (fieldNames === undefined) {
      return typeInfo;
    }

    const inlineObjectMembers = typeInfo.inlineObjectMembers;
    if (inlineObjectMembers === null || inlineObjectMembers.length === 0) {
      return typeInfo;
    }

    const primaryFieldName = fieldNames[0];
    if (primaryFieldName === undefined) {
      return typeInfo;
    }

    // Group members by discriminator value tuple
    const groups = new Map<string, InlineObjectMember[]>();
    for (const member of inlineObjectMembers) {
      const primaryValue = getDiscriminatorValue(member, primaryFieldName);
      if (primaryValue === null) {
        // Cannot group this member; leave as-is
        continue;
      }

      const secondaryValues = fieldNames
        .slice(1)
        .map((fn) => getDiscriminatorValue(member, fn));
      const tupleKey = JSON.stringify([primaryValue, ...secondaryValues]);

      let group = groups.get(tupleKey);
      if (group === undefined) {
        group = [];
        groups.set(tupleKey, group);
      }
      group.push(member);
    }

    // If no groups were formed, no flattening needed
    if (groups.size === 0) {
      return typeInfo;
    }

    // Check if flattening is actually needed (i.e., any group has more than 1 member)
    const needsFlattening = Array.from(groups.values()).some(
      (g) => g.length > 1,
    );
    if (!needsFlattening) {
      return typeInfo;
    }

    // Flatten each group into a single member
    const flattenedMembers: InlineObjectMember[] = [];
    for (const group of groups.values()) {
      const mergedProperties = mergeGroupProperties(group, [...fieldNames]);
      flattenedMembers.push({ properties: mergedProperties });
    }

    return {
      ...typeInfo,
      inlineObjectMembers: flattenedMembers,
    };
  });
}
