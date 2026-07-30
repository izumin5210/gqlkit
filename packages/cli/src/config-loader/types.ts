import type { ImportExtension } from "../config/types.js";

/**
 * Resolved scalar mapping. Field names differ from the user-facing
 * ScalarMappingConfig shape (`name`/`tsType`) because this is the internal,
 * already-normalized representation shared by every downstream stage.
 */
export interface ResolvedScalarMapping {
  readonly graphqlName: string;
  readonly typeName: string;
  readonly importPath: string | null;
  readonly only: "input" | "output" | null;
  readonly description: string | null;
}

export const DEFAULT_SOURCE_DIR = "src/gqlkit/schema";
export const DEFAULT_RESOLVERS_PATH = "src/gqlkit/__generated__/resolvers.ts";
export const DEFAULT_TYPEDEFS_PATH = "src/gqlkit/__generated__/typeDefs.ts";
export const DEFAULT_SCHEMA_PATH = "src/gqlkit/__generated__/schema.graphql";
export const DEFAULT_IMPORT_EXTENSION: ImportExtension = "js";

/**
 * Resolved output configuration.
 * Undefined values are resolved to defaults.
 */
export interface ResolvedOutputConfig {
  /** Resolver map output path. Null suppresses output */
  readonly resolversPath: string | null;
  /** Schema AST (typeDefs) output path. Null suppresses output */
  readonly typeDefsPath: string | null;
  /** Schema SDL output path. Null suppresses output */
  readonly schemaPath: string | null;
  /** File extension for imports. Default: "js" */
  readonly importExtension: ImportExtension;
  /** Prune types unreachable from root operation types. Default: true */
  readonly pruning: boolean;
}

/**
 * Resolved hook configuration.
 * Commands are normalized to array format.
 */
export interface ResolvedHooksConfig {
  /** Normalized to array (empty if not configured) */
  readonly afterAllFileWrite: ReadonlyArray<string>;
}

/**
 * Normalized discriminator fields mapping.
 * All values are normalized to arrays (single strings are wrapped in arrays).
 */
export type ResolvedDiscriminatorFieldsMap = ReadonlyMap<
  string,
  ReadonlyArray<string>
>;

export interface ResolvedConfig {
  readonly sourceDir: string;
  readonly sourceIgnoreGlobs: ReadonlyArray<string>;
  readonly output: ResolvedOutputConfig;
  readonly scalars: ReadonlyArray<ResolvedScalarMapping>;
  readonly tsconfigPath: string | null;
  readonly hooks: ResolvedHooksConfig;
  readonly discriminatorFields: ResolvedDiscriminatorFieldsMap;
}
