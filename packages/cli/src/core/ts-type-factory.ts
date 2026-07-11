import type ts from "typescript";
import type { DeprecationInfo } from "./metadata.js";
import type {
  InlineEnumMemberInfo,
  PropertyDef,
  ScalarTypeInfo,
  TSTypeReference,
} from "./ts-types.js";

interface CreateTSTypeReferenceParams {
  readonly kind: TSTypeReference["kind"];
  readonly overrides: Partial<TSTypeReference>;
}

function createTSTypeReference(
  params: CreateTSTypeReferenceParams,
): TSTypeReference {
  return {
    kind: params.kind,
    name: null,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
    inlineObjectHintName: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    ...params.overrides,
  };
}

interface CreateReferenceTypeParams {
  readonly name: string;
  readonly nullable: boolean;
}

export function createReferenceType(
  params: CreateReferenceTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "reference",
    overrides: { name: params.name, nullable: params.nullable },
  });
}

interface CreatePrimitiveTypeParams {
  readonly name: string;
  readonly nullable: boolean;
}

export function createPrimitiveType(
  params: CreatePrimitiveTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "primitive",
    overrides: { name: params.name, nullable: params.nullable },
  });
}

export function createArrayType(elementType: TSTypeReference): TSTypeReference {
  return createTSTypeReference({ kind: "array", overrides: { elementType } });
}

interface CreateUnionTypeParams {
  readonly members: ReadonlyArray<TSTypeReference>;
  readonly nullable: boolean;
  /** The TypeScript type alias name for this union (e.g., "ItemPart" for `type ItemPart = A | B`) */
  readonly aliasName: string | null;
}

export function createUnionType(
  params: CreateUnionTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "union",
    overrides: {
      members: params.members,
      nullable: params.nullable,
      name: params.aliasName,
    },
  });
}

interface CreateInlineObjectTypeParams {
  readonly properties: ReadonlyArray<PropertyDef>;
  /** TSDoc description from the type alias (null for true inline objects) */
  readonly description: string | null;
  /** Deprecation info from the `@deprecated` TSDoc tag on the type alias (null for true inline objects) */
  readonly deprecated: DeprecationInfo | null;
  /** Original type name hint for inline objects extracted from external types */
  readonly hintName: string | null;
}

export function createInlineObjectType(
  params: CreateInlineObjectTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "inlineObject",
    overrides: {
      inlineObjectProperties: params.properties,
      inlineObjectDescription: params.description,
      inlineObjectDeprecated: params.deprecated,
      inlineObjectHintName: params.hintName,
    },
  });
}

interface CreateScalarTypeParams {
  readonly name: string;
  readonly scalarInfo: ScalarTypeInfo;
  readonly nullable: boolean;
}

export function createScalarType(
  params: CreateScalarTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "scalar",
    overrides: {
      name: params.name,
      scalarInfo: params.scalarInfo,
      nullable: params.nullable,
    },
  });
}

export function createNeverType(): TSTypeReference {
  return createTSTypeReference({ kind: "never", overrides: {} });
}

export function createStringLiteralType(name: string): TSTypeReference {
  return createTSTypeReference({ kind: "stringLiteral", overrides: { name } });
}

export function createNumericLiteralType(name: string): TSTypeReference {
  return createTSTypeReference({
    kind: "numericLiteral",
    overrides: { name },
  });
}

interface CreateInlineEnumTypeParams {
  readonly members: ReadonlyArray<InlineEnumMemberInfo>;
  readonly nullable: boolean;
  /** External TypeScript enum symbol for deduplication (null for string literal unions) */
  readonly externalEnumSymbol: ts.Symbol | null;
  /** TSDoc description from the external enum type itself (null for string literal unions) */
  readonly externalEnumDescription: string | null;
  /** Deprecation info from the `@deprecated` TSDoc tag on the external enum type itself (null for string literal unions) */
  readonly externalEnumDeprecated: DeprecationInfo | null;
}

export function createInlineEnumType(
  params: CreateInlineEnumTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "inlineEnum",
    overrides: {
      inlineEnumMembers: params.members,
      nullable: params.nullable,
      externalEnumSymbol: params.externalEnumSymbol,
      externalEnumDescription: params.externalEnumDescription,
      externalEnumDeprecated: params.externalEnumDeprecated,
    },
  });
}
