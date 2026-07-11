import type { PropertyDef } from "../core/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import {
  findTypenameProperty,
  type TypenameFieldInfo,
} from "./typename-types.js";

export type { TypenameFieldInfo } from "./typename-types.js";

export interface MemberTypenameInfo {
  readonly memberTypeName: string | null;
  readonly memberIndex: number;
  readonly typenameInfo: TypenameFieldInfo | null;
  readonly isInlineObject: boolean;
}

export interface TypenameExtractionResult {
  readonly abstractTypeName: string;
  readonly abstractTypeKind: "union" | "interface";
  readonly members: ReadonlyArray<MemberTypenameInfo>;
  readonly allMembersHaveTypename: boolean;
  readonly hasInlineObjects: boolean;
}

export interface ExtractTypenamesParams {
  readonly abstractType: ExtractedTypeInfo;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
}

function extractTypenameFromFields(
  fields: ReadonlyArray<PropertyDef>,
): TypenameFieldInfo | null {
  const found = findTypenameProperty(fields, (f) => f.name);
  if (!found) {
    return null;
  }

  const { property: field, fieldName } = found;

  if (field.optional) {
    return null;
  }

  const { tsType } = field;
  if (
    tsType.nullable ||
    tsType.kind !== "stringLiteral" ||
    tsType.name === null
  ) {
    return null;
  }

  return { typeName: tsType.name, fieldName };
}

function extractTypenameFromInlineObjectProperties(
  properties: ReadonlyArray<PropertyDef>,
): TypenameFieldInfo | null {
  const found = findTypenameProperty(properties, (p) => p.name);
  if (!found) {
    return null;
  }

  const { property, fieldName } = found;
  const { tsType } = property;

  if (
    tsType.nullable ||
    tsType.kind !== "stringLiteral" ||
    tsType.name === null
  ) {
    return null;
  }

  return { typeName: tsType.name, fieldName };
}

function extractUnionMemberTypenames(
  params: ExtractTypenamesParams,
): TypenameExtractionResult {
  const { abstractType, typeMap } = params;
  const members: MemberTypenameInfo[] = [];
  let allMembersHaveTypename = true;

  const unionMembers = abstractType.unionMembers ?? [];
  const inlineObjectMembers = abstractType.inlineObjectMembers ?? [];
  const hasInlineObjects = inlineObjectMembers.length > 0;

  let memberIndex = 0;

  for (const memberName of unionMembers) {
    const memberType = typeMap.get(memberName);

    if (!memberType) {
      members.push({
        memberTypeName: memberName,
        memberIndex,
        typenameInfo: null,
        isInlineObject: false,
      });
      allMembersHaveTypename = false;
      memberIndex++;
      continue;
    }

    const typenameInfo = extractTypenameFromFields(memberType.fields);

    if (typenameInfo === null) {
      allMembersHaveTypename = false;
    }

    members.push({
      memberTypeName: memberName,
      memberIndex,
      typenameInfo,
      isInlineObject: false,
    });
    memberIndex++;
  }

  for (const inlineObjectMember of inlineObjectMembers) {
    const typenameInfo = extractTypenameFromInlineObjectProperties(
      inlineObjectMember.properties,
    );

    if (typenameInfo === null) {
      allMembersHaveTypename = false;
    }

    members.push({
      memberTypeName: null,
      memberIndex,
      typenameInfo,
      isInlineObject: true,
    });
    memberIndex++;
  }

  return {
    abstractTypeName: abstractType.metadata.name,
    abstractTypeKind: "union",
    members,
    allMembersHaveTypename,
    hasInlineObjects,
  };
}

function extractInterfaceImplementerTypenames(
  params: ExtractTypenamesParams,
  implementers: ReadonlyArray<ExtractedTypeInfo>,
): TypenameExtractionResult {
  const { abstractType } = params;
  const members: MemberTypenameInfo[] = [];
  let allMembersHaveTypename = true;
  const hasInlineObjects = false;

  for (let i = 0; i < implementers.length; i++) {
    const implementer = implementers[i]!;
    const typenameInfo = extractTypenameFromFields(implementer.fields);

    if (typenameInfo === null) {
      allMembersHaveTypename = false;
    }

    members.push({
      memberTypeName: implementer.metadata.name,
      memberIndex: i,
      typenameInfo,
      isInlineObject: false,
    });
  }

  return {
    abstractTypeName: abstractType.metadata.name,
    abstractTypeKind: "interface",
    members,
    allMembersHaveTypename,
    hasInlineObjects,
  };
}

function extractTypenames(
  params: ExtractTypenamesParams,
): TypenameExtractionResult | null {
  const { abstractType, typeMap } = params;

  if (abstractType.metadata.kind === "union") {
    return extractUnionMemberTypenames(params);
  }

  if (abstractType.metadata.kind === "graphqlInterface") {
    const implementers: ExtractedTypeInfo[] = [];
    for (const typeInfo of typeMap.values()) {
      if (
        typeInfo.implementedInterfaces?.includes(abstractType.metadata.name)
      ) {
        implementers.push(typeInfo);
      }
    }

    if (implementers.length === 0) {
      return null;
    }

    return extractInterfaceImplementerTypenames(params, implementers);
  }

  return null;
}

export interface CollectTypenameExtractionsParams {
  readonly extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
  /** Union names that have discriminatorFields configured; these are excluded from typename extraction. */
  readonly discriminatorFieldUnionNames: ReadonlySet<string>;
}

export function collectTypenameExtractions(
  params: CollectTypenameExtractionsParams,
): ReadonlyArray<TypenameExtractionResult> {
  const { extractedTypes, typeMap, discriminatorFieldUnionNames } = params;
  const results: TypenameExtractionResult[] = [];

  for (const typeInfo of extractedTypes) {
    if (
      typeInfo.metadata.kind === "union" ||
      typeInfo.metadata.kind === "graphqlInterface"
    ) {
      // Skip unions that have discriminatorFields configured; they use the discriminator pipeline instead
      if (discriminatorFieldUnionNames.has(typeInfo.metadata.name)) {
        continue;
      }
      const result = extractTypenames({ abstractType: typeInfo, typeMap });
      if (result !== null) {
        results.push(result);
      }
    }
  }

  return results;
}
