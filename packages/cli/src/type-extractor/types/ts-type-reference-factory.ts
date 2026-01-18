import type {
  InlineObjectPropertyDef,
  ScalarTypeInfo,
  TSTypeReference,
} from "./typescript.js";

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
}

export function createUnionType(
  params: CreateUnionTypeParams,
): TSTypeReference {
  return createTSTypeReference({
    kind: "union",
    overrides: { members: params.members, nullable: params.nullable },
  });
}

export function createInlineObjectType(
  properties: ReadonlyArray<InlineObjectPropertyDef>,
): TSTypeReference {
  return createTSTypeReference({
    kind: "inlineObject",
    overrides: { inlineObjectProperties: properties },
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

export function createLiteralType(name: string): TSTypeReference {
  return createTSTypeReference({ kind: "literal", overrides: { name } });
}
