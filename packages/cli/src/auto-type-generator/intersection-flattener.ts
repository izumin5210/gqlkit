import type { ResolvedDiscriminatorFieldsMap } from "../config-loader/index.js";
import {
  createInlineObjectType,
  createPrimitiveType,
  type InlineObjectMember,
  type InlineObjectProperty,
  type InlineObjectPropertyDef,
  type TSTypeReference,
} from "../core/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/types/index.js";
import { generateDiscriminatorMemberName } from "./discriminator-naming.js";
import type {
  InlineUnionMemberInfo,
  InlineUnionWithContext,
} from "./inline-union-types.js";
import { generateAutoTypeName } from "./naming-convention.js";

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

// --- Inline union member flattening ---

/**
 * Extracts a string literal discriminator value from an InlineObjectPropertyDef.
 */
function getDiscriminatorValueFromPropertyDef(
  properties: ReadonlyArray<InlineObjectPropertyDef>,
  fieldName: string,
): string | null {
  for (const prop of properties) {
    if (prop.name === fieldName) {
      if (prop.tsType.kind === "stringLiteral" && prop.tsType.name !== null) {
        return prop.tsType.name;
      }
      return null;
    }
  }
  return null;
}

interface PropertyDefContribution {
  readonly property: InlineObjectPropertyDef;
  readonly isNever: boolean;
}

/**
 * Merges InlineObjectPropertyDef arrays from a group of inline object members.
 */
function mergeGroupPropertyDefs(
  groups: ReadonlyArray<ReadonlyArray<InlineObjectPropertyDef>>,
  discriminatorFieldNames: ReadonlyArray<string>,
): ReadonlyArray<InlineObjectPropertyDef> {
  const discriminatorFieldSet = new Set(discriminatorFieldNames);

  const allPropertyNames = new Set<string>();
  for (const properties of groups) {
    for (const prop of properties) {
      allPropertyNames.add(prop.name);
    }
  }

  const merged: InlineObjectPropertyDef[] = [];

  for (const propName of allPropertyNames) {
    const contributions: PropertyDefContribution[] = [];
    for (const properties of groups) {
      const prop = properties.find((p) => p.name === propName);
      if (prop !== undefined) {
        contributions.push({
          property: prop,
          isNever: isAbsentType(prop.tsType),
        });
      }
    }

    const nonNeverContributions = contributions.filter((c) => !c.isNever);
    if (nonNeverContributions.length === 0) {
      continue;
    }

    const presentInAllMembers = nonNeverContributions.length === groups.length;
    const firstContribution = nonNeverContributions[0]!;

    let allSameType = true;
    for (let i = 1; i < nonNeverContributions.length; i++) {
      if (
        !isSameTypeIgnoringNullability(
          firstContribution.property.tsType,
          nonNeverContributions[i]!.property.tsType,
        )
      ) {
        allSameType = false;
        break;
      }
    }

    // Discriminator fields: keep original value
    if (discriminatorFieldSet.has(propName)) {
      merged.push(firstContribution.property);
      continue;
    }

    if (allSameType) {
      const anyNullable = nonNeverContributions.some(
        (c) => c.property.tsType.nullable,
      );
      const anyOptional = nonNeverContributions.some(
        (c) => c.property.optional,
      );
      const needsNullable = !presentInAllMembers || anyNullable || anyOptional;
      const baseType = firstContribution.property.tsType;
      merged.push({
        ...firstContribution.property,
        optional: !presentInAllMembers || anyOptional,
        tsType:
          needsNullable && !baseType.nullable
            ? { ...baseType, nullable: true }
            : baseType,
      });
    } else {
      // Different types → widen to String
      const needsNullable = !presentInAllMembers;
      merged.push({
        ...firstContribution.property,
        optional: !presentInAllMembers,
        tsType: createPrimitiveType({
          name: "string",
          nullable: needsNullable,
        }),
        description: null,
        deprecated: null,
      });
    }
  }

  return merged;
}

export interface InlineDiscriminatorResolveType {
  readonly unionTypeName: string;
  readonly fieldNames: ReadonlyArray<string>;
  readonly valueMappings: ReadonlyArray<{
    readonly memberGraphQLTypeName: string;
    readonly values: ReadonlyArray<string | null>;
  }>;
}

export interface FlattenInlineUnionMembersParams {
  readonly inlineUnions: ReadonlyArray<InlineUnionWithContext>;
  readonly discriminatorFields: ResolvedDiscriminatorFieldsMap;
}

export interface FlattenInlineUnionMembersResult {
  readonly inlineUnions: ReadonlyArray<InlineUnionWithContext>;
  readonly inlineDiscriminatorResolveTypes: ReadonlyArray<InlineDiscriminatorResolveType>;
}

/**
 * Pre-processes inline unions that match discriminatorFields config.
 * Groups inline object members by discriminator value and merges them,
 * producing flattened members with inlineObjectHintName set for naming.
 * Also returns discriminator resolveType info for generating __resolveType functions.
 *
 * This handles the case where TypeScript distributes intersections over unions
 * within field types (e.g., `parts: UIMessagePart<...>[]`), creating many
 * anonymous inline objects that would otherwise cause UNNAMEABLE_UNION_MEMBER errors.
 */
export function flattenInlineUnionMembers(
  params: FlattenInlineUnionMembersParams,
): FlattenInlineUnionMembersResult {
  const { inlineUnions, discriminatorFields } = params;

  if (discriminatorFields.size === 0) {
    return { inlineUnions, inlineDiscriminatorResolveTypes: [] };
  }

  const inlineDiscriminatorResolveTypes: InlineDiscriminatorResolveType[] = [];
  const resultUnions: InlineUnionWithContext[] = [];

  for (const inlineUnion of inlineUnions) {
    const unionTypeName = generateAutoTypeName(inlineUnion.context);
    const fieldNames = discriminatorFields.get(unionTypeName);
    if (fieldNames === undefined) {
      resultUnions.push(inlineUnion);
      continue;
    }

    const primaryFieldName = fieldNames[0];
    if (primaryFieldName === undefined) {
      resultUnions.push(inlineUnion);
      continue;
    }

    // Only process inline object members
    const inlineObjectMembers: Array<{
      member: InlineUnionMemberInfo;
      properties: ReadonlyArray<InlineObjectPropertyDef>;
    }> = [];
    const nonInlineMembers: InlineUnionMemberInfo[] = [];

    for (const member of inlineUnion.members) {
      if (
        member.memberType.kind === "inlineObject" &&
        member.memberType.inlineObjectProperties
      ) {
        inlineObjectMembers.push({
          member,
          properties: member.memberType.inlineObjectProperties,
        });
      } else {
        nonInlineMembers.push(member);
      }
    }

    if (inlineObjectMembers.length === 0) {
      resultUnions.push(inlineUnion);
      continue;
    }

    // Group by discriminator value tuple
    const groups = new Map<
      string,
      Array<ReadonlyArray<InlineObjectPropertyDef>>
    >();
    const groupValues = new Map<string, ReadonlyArray<string | null>>();

    for (const { properties } of inlineObjectMembers) {
      const primaryValue = getDiscriminatorValueFromPropertyDef(
        properties,
        primaryFieldName,
      );
      if (primaryValue === null) {
        continue;
      }

      const secondaryValues = fieldNames
        .slice(1)
        .map((fn) => getDiscriminatorValueFromPropertyDef(properties, fn));
      const tupleKey = JSON.stringify([primaryValue, ...secondaryValues]);

      let group = groups.get(tupleKey);
      if (group === undefined) {
        group = [];
        groups.set(tupleKey, group);
        groupValues.set(tupleKey, [primaryValue, ...secondaryValues]);
      }
      group.push(properties);
    }

    if (groups.size === 0) {
      resultUnions.push(inlineUnion);
      continue;
    }

    // Flatten each group into a single member with hint name
    const flattenedMembers: InlineUnionMemberInfo[] = [];
    const valueMappings: InlineDiscriminatorResolveType["valueMappings"][number][] =
      [];

    for (const [tupleKey, group] of groups) {
      const values = groupValues.get(tupleKey)!;
      const mergedProperties = mergeGroupPropertyDefs(group, [...fieldNames]);
      const hintName = generateDiscriminatorMemberName({
        unionTypeName,
        values,
      });

      flattenedMembers.push({
        memberType: createInlineObjectType({
          properties: mergedProperties,
          description: null,
          deprecated: null,
          hintName,
        }),
        needsAutoGeneration: true,
      });

      valueMappings.push({
        memberGraphQLTypeName: hintName,
        values,
      });
    }

    resultUnions.push({
      ...inlineUnion,
      members: [...nonInlineMembers, ...flattenedMembers],
    });

    inlineDiscriminatorResolveTypes.push({
      unionTypeName,
      fieldNames: [...fieldNames],
      valueMappings,
    });
  }

  return { inlineUnions: resultUnions, inlineDiscriminatorResolveTypes };
}
