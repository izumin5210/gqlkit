/**
 * Schema output options.
 * Allows configuring AST and SDL output paths separately.
 */
export interface SchemaOutputConfig {
  /**
   * Output path for AST (DocumentNode) format.
   * - If relative, resolved from project root
   * - If null, suppresses AST output
   * - If undefined, uses default path
   * @default "src/gqlkit/generated/schema.ts"
   */
  readonly ast?: string | null;

  /**
   * Output path for SDL format.
   * - If relative, resolved from project root
   * - If null, suppresses SDL output
   * - If undefined, uses default path
   * @default "src/gqlkit/generated/schema.graphql"
   */
  readonly sdl?: string | null;
}

/**
 * Type definition for gqlkit configuration file.
 * Used in `gqlkit.config.ts`.
 */
export interface GqlkitConfig {
  /**
   * Custom scalar mapping definitions.
   * Configures the mapping between branded types and GraphQL scalars.
   */
  readonly scalars?: ReadonlyArray<ScalarMappingConfig>;

  /**
   * Schema output configuration.
   * Allows configuring AST and SDL output paths separately.
   */
  readonly output?: SchemaOutputConfig;

  /**
   * Path to TypeScript configuration file.
   * - If relative, resolved from config file
   * - Absolute paths are also supported
   * - If unspecified, automatically searches for tsconfig.json in project root
   */
  readonly tsconfigPath?: string;
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
