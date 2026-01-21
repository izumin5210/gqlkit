# @gqlkit-ts/cli

## 0.2.0

### Minor Changes

- [#100](https://github.com/izumin5210/gqlkit/pull/100) [`a197196`](https://github.com/izumin5210/gqlkit/commit/a197196b4228fd31ceffe7114b664601f1e113f1) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: auto-convert enum values to SCREAMING_SNAKE_CASE

- [#102](https://github.com/izumin5210/gqlkit/pull/102) [`ec6a0f8`](https://github.com/izumin5210/gqlkit/commit/ec6a0f8a6ad72518fc866df343ebd3ac3817be26) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: auto-generate GraphQL enum types from inline string literal unions and external TypeScript enums

- [#98](https://github.com/izumin5210/gqlkit/pull/98) [`55a613b`](https://github.com/izumin5210/gqlkit/commit/55a613bc449bd49b2cd5dbf126ce926d6a403498) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: automatic scalar mapping from GqlScalar base types

  When `GqlScalar<Name, Base>` is defined, fields using the base type (e.g., `Date`) are now automatically mapped to the corresponding scalar type (e.g., `DateTime`) in the generated GraphQL schema.

  Example:

  ```ts
  // Define scalar with base type
  export type DateTime = GqlScalar<"DateTime", Date>;

  // Use base type directly in fields
  export interface Event {
    createdAt: Date; // Generates: createdAt: DateTime!
  }
  ```

  Features:

  - Symbol-based comparison for accurate type matching across files
  - Context-aware mapping (input vs output) with `GqlScalar<Name, Base, "input" | "output">` constraints
  - Conflict detection when multiple scalars share the same base type

- [#95](https://github.com/izumin5210/gqlkit/pull/95) [`debacd5`](https://github.com/izumin5210/gqlkit/commit/debacd5acea6757a911d3ebd4f18036d0be0a325) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: correctly preserve type alias names in schema generation

  - Type alias names lost when using `Simplify<T>` pattern
  - Type alias names lost when using `typeof value` pattern
  - Same-named types from different sources incorrectly matched

  These issues are resolved by introducing a 2-phase type extraction architecture with symbol-based comparison:

  - Phase 1 collects all declared type names from schema files
  - Phase 2 uses collected names during field type resolution to determine if types should be preserved or expanded
  - Symbol-based type comparison enables accurate identity comparison for type alias re-exports
  - Structural type detection (NoArgs, scalars, etc.) by metadata properties instead of type names

### Patch Changes

- [#92](https://github.com/izumin5210/gqlkit/pull/92) [`b8c796f`](https://github.com/izumin5210/gqlkit/commit/b8c796f2e13b136016ea113006f8bb22cb4cd181) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: resolve type aliases correctly in resolver return types and arguments

  Type aliases used in `defineQuery`, `defineMutation`, and `defineField` type arguments are now correctly resolved. Previously, when a type alias (e.g., `type UserId = string`) was used in resolver return types or arguments, it was incorrectly expanded to its underlying type instead of preserving the alias name.

- [#90](https://github.com/izumin5210/gqlkit/pull/90) [`a4e9d8d`](https://github.com/izumin5210/gqlkit/commit/a4e9d8dba63eb28278c4d8291c4d7c4769117bff) Thanks [@izumin5210](https://github.com/izumin5210)! - build: include source files and maps in published packages

  Sourcemaps (`.js.map`), declaration files (`.d.ts`), declaration maps (`.d.ts.map`), and original TypeScript source files are now included in npm packages. This improves debugging experience by allowing IDE go-to-definition to navigate directly to the original source code.

## 0.1.0

### Minor Changes

- [#84](https://github.com/izumin5210/gqlkit/pull/84) [`9550480`](https://github.com/izumin5210/gqlkit/commit/955048047b389d57cad9468f0e44b0f83fb07484) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: initial release
