import type {
  InlineObjectPropertyDef,
  ScalarTypeInfo,
  TSTypeReference,
} from "./typescript.js";

function createTSTypeReference(
  kind: TSTypeReference["kind"],
  overrides?: Partial<TSTypeReference>,
): TSTypeReference {
  return {
    kind,
    name: null,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: null,
    inlineObjectProperties: null,
    ...overrides,
  };
}

export function createReferenceType(
  name: string,
  nullable = false,
): TSTypeReference {
  return createTSTypeReference("reference", { name, nullable });
}

export function createPrimitiveType(
  name: string,
  nullable = false,
): TSTypeReference {
  return createTSTypeReference("primitive", { name, nullable });
}

export function createArrayType(elementType: TSTypeReference): TSTypeReference {
  return createTSTypeReference("array", { elementType });
}

export function createUnionType(
  members: ReadonlyArray<TSTypeReference>,
  nullable = false,
): TSTypeReference {
  return createTSTypeReference("union", { members, nullable });
}

export function createInlineObjectType(
  properties: ReadonlyArray<InlineObjectPropertyDef>,
): TSTypeReference {
  return createTSTypeReference("inlineObject", {
    inlineObjectProperties: properties,
  });
}

export function createScalarType(
  name: string,
  scalarInfo: ScalarTypeInfo,
  nullable = false,
): TSTypeReference {
  return createTSTypeReference("scalar", { name, scalarInfo, nullable });
}

export function createLiteralType(name: string): TSTypeReference {
  return createTSTypeReference("literal", { name });
}
