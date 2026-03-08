import type {
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type { AutoTypeNameContext } from "./naming-convention.js";

/**
 * Information about a single member of an inline union type.
 * Tracks the type reference and whether it needs auto-generation.
 */
export interface InlineUnionMemberInfo {
  /** Member type reference (can be reference, inlineObject, etc.) */
  readonly memberType: TSTypeReference;
  /** True if this member needs to be auto-generated as a named type */
  readonly needsAutoGeneration: boolean;
}

/**
 * Inline union with context information for naming and generation.
 * Used for both Union types (output context) and OneOf Input types (input context).
 */
export interface InlineUnionWithContext {
  /** Union members with their type info and auto-generation requirements */
  readonly members: ReadonlyArray<InlineUnionMemberInfo>;
  /** Context for generating the auto type name */
  readonly context: AutoTypeNameContext;
  /** Source location for error reporting */
  readonly sourceLocation: SourceLocation;
  /** Whether this union type is nullable */
  readonly nullable: boolean;
  /** True if this union is in input context (should become @oneOf Input Object) */
  readonly isInputContext: boolean;
  /** The TypeScript type alias name for this union (for mapping to auto-generated names) */
  readonly unionAliasName: string | null;
}
