/**
 * Shared test-fixture builders for the `PropertyDef`/`ExtractedTypeInfo`/
 * `InlineObjectMember` shapes that auto-type-generator's unit tests
 * construct by hand. These shapes have no production factory (unlike
 * `TSTypeReference`, which is built via `core/ts-type-factory.ts` —
 * `inline-collector.test.ts` shows the right pattern of using those
 * factories directly instead of hand-rolling `TSTypeReference` literals).
 *
 * Before this module existed, `discriminator-field-validator.test.ts` and
 * `discriminator-resolve-type-generator.test.ts` each hand-rolled
 * near-identical versions of every builder below (refactor-plan.md §1.5).
 */

import type {
  InlineObjectMember,
  PropertyDef,
  SourceLocation,
  TSTypeReference,
} from "../core/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";

export interface CreatePropertyDefParams {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly sourceLocation: SourceLocation | null;
}

/** A minimal, non-optional, metadata-free `PropertyDef` for a single field/property. */
export function createPropertyDef(
  params: CreatePropertyDefParams,
): PropertyDef {
  const { name, tsType, sourceLocation } = params;
  return {
    name,
    tsType,
    optional: false,
    description: null,
    deprecated: null,
    directives: null,
    defaultValue: null,
    sourceLocation,
  };
}

const DEFAULT_TEST_SOURCE_FILE = "src/types.ts";
const DEFAULT_TEST_SOURCE_LOCATION: SourceLocation = {
  file: DEFAULT_TEST_SOURCE_FILE,
  line: 1,
  column: 1,
};

export interface CreateExtractedObjectTypeParams {
  readonly name: string;
  readonly fields: ReadonlyArray<PropertyDef>;
}

/** A minimal declared object type with no interfaces, description, or metadata. */
export function createExtractedObjectType(
  params: CreateExtractedObjectTypeParams,
): ExtractedTypeInfo {
  const { name, fields } = params;
  return {
    metadata: {
      name,
      kind: "object",
      sourceFile: DEFAULT_TEST_SOURCE_FILE,
      sourceLocation: DEFAULT_TEST_SOURCE_LOCATION,
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields,
    unionMembers: null,
    inlineObjectMembers: null,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

export interface CreateExtractedUnionTypeParams {
  readonly name: string;
  readonly unionMembers: ReadonlyArray<string>;
}

/** A minimal declared union type with only its named members set. */
export function createExtractedUnionType(
  params: CreateExtractedUnionTypeParams,
): ExtractedTypeInfo {
  const { name, unionMembers } = params;
  return {
    metadata: {
      name,
      kind: "union",
      sourceFile: DEFAULT_TEST_SOURCE_FILE,
      sourceLocation: DEFAULT_TEST_SOURCE_LOCATION,
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields: [],
    unionMembers,
    inlineObjectMembers: null,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

export interface CreateExtractedUnionTypeWithInlineMembersParams {
  readonly name: string;
  readonly unionMembers: ReadonlyArray<string>;
  readonly inlineObjectMembers: ReadonlyArray<InlineObjectMember>;
}

/**
 * A declared union type that also carries anonymous inline-object members
 * (the shape discriminator-field collection/validation reads alongside
 * named members).
 */
export function createExtractedUnionTypeWithInlineMembers(
  params: CreateExtractedUnionTypeWithInlineMembersParams,
): ExtractedTypeInfo {
  const { name, unionMembers, inlineObjectMembers } = params;
  return {
    metadata: {
      name,
      kind: "union",
      sourceFile: DEFAULT_TEST_SOURCE_FILE,
      sourceLocation: DEFAULT_TEST_SOURCE_LOCATION,
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields: [],
    unionMembers,
    inlineObjectMembers,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

/**
 * An `InlineObjectMember` built from bare `{ name, tsType }` pairs — every
 * other `PropertyDef` field (optionality, metadata, source location) is
 * filled with its "unset" value, matching how real union-member extraction
 * fills fields it doesn't compute (refactor-plan.md §1.2-C).
 */
export function createInlineObjectMember(
  properties: ReadonlyArray<{ name: string; tsType: TSTypeReference }>,
): InlineObjectMember {
  return {
    properties: properties.map((p) =>
      createPropertyDef({
        name: p.name,
        tsType: p.tsType,
        sourceLocation: null,
      }),
    ),
  };
}
