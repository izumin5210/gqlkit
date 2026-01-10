# Configuration

gqlkit can be configured via `gqlkit.config.ts` in your project root.

## Basic Configuration

```ts
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  // Source directory (default: "src/gqlkit/schema")
  sourceDir: "src/gqlkit/schema",

  // Glob patterns to exclude from scanning
  sourceIgnoreGlobs: ["**/*.test.ts"],

  // Custom scalar mappings (config-based approach)
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime",
    },
    {
      name: "UUID",
      tsType: { name: "string" }, // Global type
    },
  ],

  // Output paths
  output: {
    typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
    resolversPath: "src/gqlkit/__generated__/resolvers.ts",
    schemaPath: "src/gqlkit/__generated__/schema.graphql",
    // Set to null to disable output:
    // schemaPath: null,
  },

  // Hooks
  hooks: {
    // Run after all files are written (e.g., formatting)
    afterAllFileWrite: "prettier --write",
    // Or multiple commands:
    // afterAllFileWrite: ["prettier --write", "eslint --fix"],
  },
});
```

## Custom Scalar Types

Map TypeScript types to GraphQL custom scalars via config:

```ts
export default defineConfig({
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime string",
    },
    {
      name: "UUID",
      tsType: { name: "string" },
      only: "input", // Input-only scalar
    },
  ],
});
```

### Scalar Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | The GraphQL scalar name |
| `tsType.name` | `string` | The TypeScript type name |
| `tsType.from` | `string` (optional) | Import path for the type (omit for global types) |
| `description` | `string` (optional) | Description for the GraphQL schema |
| `only` | `"input"` \| `"output"` (optional) | Restrict scalar to input or output positions |

::: tip
You can also define custom scalars using the `GqlScalar` utility type directly in your schema files. See [Scalars](/guide/schema/scalars) for more details.
:::

## Output Paths

Customize output file locations or disable specific outputs:

```ts
export default defineConfig({
  output: {
    typeDefsPath: "generated/schema.ts", // Custom path
    resolversPath: "generated/resolvers.ts",
    schemaPath: null, // Disable SDL output
  },
});
```

### Output Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `typeDefsPath` | `string` \| `null` | `"src/gqlkit/__generated__/typeDefs.ts"` | Path for the TypeDefs output |
| `resolversPath` | `string` \| `null` | `"src/gqlkit/__generated__/resolvers.ts"` | Path for the resolvers output |
| `schemaPath` | `string` \| `null` | `"src/gqlkit/__generated__/schema.graphql"` | Path for the SDL output |

Set any path to `null` to disable that output.

## Hooks

Execute commands after file generation:

```ts
export default defineConfig({
  hooks: {
    // Single command
    afterAllFileWrite: "prettier --write",
  },
});
```

You can also specify multiple commands to run sequentially:

```ts
export default defineConfig({
  hooks: {
    // Multiple commands (executed sequentially)
    afterAllFileWrite: ["prettier --write", "eslint --fix"],
  },
});
```

### Available Hooks

| Hook | Description |
|------|-------------|
| `afterAllFileWrite` | Runs after all generated files are written. Receives the list of written file paths. |

## Source Directory

By default, gqlkit scans `src/gqlkit/schema` for types and resolvers.

```ts
export default defineConfig({
  sourceDir: "src/graphql/schema", // Custom source directory
});
```

All TypeScript files (`.ts`, `.cts`, `.mts`) under this directory are scanned.

## Ignore Patterns

Exclude files from scanning using glob patterns:

```ts
export default defineConfig({
  sourceIgnoreGlobs: [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/testdata/**",
  ],
});
```
