/**
 * Output configuration for generated files.
 * All paths are relative to project root.
 */
export interface OutputConfig {
  /**
   * Output path for resolver map file.
   * - If relative, resolved from project root
   * - If null, suppresses resolvers output
   * - If undefined, uses default path
   * @default "src/gqlkit/__generated__/resolvers.ts"
   */
  readonly resolversPath?: string | null;

  /**
   * Output path for GraphQL schema AST (DocumentNode).
   * - If relative, resolved from project root
   * - If null, suppresses AST output
   * - If undefined, uses default path
   * @default "src/gqlkit/__generated__/typeDefs.ts"
   */
  readonly typeDefsPath?: string | null;

  /**
   * Output path for GraphQL schema SDL.
   * - If relative, resolved from project root
   * - If null, suppresses SDL output
   * - If undefined, uses default path
   * @default "src/gqlkit/__generated__/schema.graphql"
   */
  readonly schemaPath?: string | null;
}

/**
 * Hook configuration for lifecycle events.
 */
export interface HooksConfig {
  /**
   * Commands to execute after all files are written.
   * Each command receives all written file paths as arguments.
   * Commands are executed sequentially in order.
   */
  readonly afterAllFileWrite?: string | ReadonlyArray<string>;
}

/**
 * Type definition for gqlkit configuration file.
 * Used in `gqlkit.config.ts`.
 */
export interface GqlkitConfig {
  /**
   * Source directory to scan for types and resolvers.
   * All TypeScript files (.ts, .cts, .mts) under this directory will be scanned.
   * @default "src/gqlkit"
   */
  readonly sourceDir?: string;

  /**
   * Glob patterns to exclude from source scanning.
   * Patterns are matched against file paths relative to sourceDir.
   * @default []
   */
  readonly sourceIgnoreGlobs?: ReadonlyArray<string>;

  /**
   * Output configuration for generated files.
   */
  readonly output?: OutputConfig;

  /**
   * Custom scalar mapping definitions.
   * Configures the mapping between branded types and GraphQL scalars.
   */
  readonly scalars?: ReadonlyArray<ScalarMappingConfig>;

  /**
   * Path to TypeScript configuration file.
   * - If relative, resolved from config file
   * - Absolute paths are also supported
   * - If unspecified, automatically searches for tsconfig.json in project root
   */
  readonly tsconfigPath?: string;

  /**
   * Hook configuration for lifecycle events.
   */
  readonly hooks?: HooksConfig;
}

/**
 * Individual custom scalar mapping configuration.
 */
export interface ScalarMappingConfig {
  /**
   * Scalar name to use in GraphQL schema.
   * Example: "DateTime", "UUID", "URL"
   */
  readonly graphqlName: string;

  /**
   * TypeScript type information to map.
   */
  readonly type: {
    /**
     * Import path for the type.
     * Example: "./src/types/scalars", "@my-lib/scalars"
     */
    readonly from: string;

    /**
     * Type name to import.
     * Example: "DateTime", "UUID"
     */
    readonly name: string;
  };
}
