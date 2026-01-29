# @gqlkit-ts/cli

## 0.4.0

### Minor Changes

- [#134](https://github.com/izumin5210/gqlkit/pull/134) [`37623b6`](https://github.com/izumin5210/gqlkit/commit/37623b6100e5fa6e7e111b8dfdb2ad8a12375fb8) Thanks [@izumin5210](https://github.com/izumin5210)! - Add `output.importExtension` config option to control file extensions in generated imports

### Patch Changes

- [#135](https://github.com/izumin5210/gqlkit/pull/135) [`20779e1`](https://github.com/izumin5210/gqlkit/commit/20779e124dd0265a879bbc014d321f4c72cd4b1e) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: add branded type handling for intersection types

- [#132](https://github.com/izumin5210/gqlkit/pull/132) [`315d56c`](https://github.com/izumin5210/gqlkit/commit/315d56c1d5ea5c0e2e0e4eabeceeab529bc98545) Thanks [@izumin5210](https://github.com/izumin5210)! - Refactor internal types to use explicit type references instead of inline declarations

## 0.3.0

### Minor Changes

- [#126](https://github.com/izumin5210/gqlkit/pull/126) [`88586a0`](https://github.com/izumin5210/gqlkit/commit/88586a00445f5432726d4c995942c96bbf1429da) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: add `docs` command to generate AI agent skill files

- [#107](https://github.com/izumin5210/gqlkit/pull/107) [`59eefd0`](https://github.com/izumin5210/gqlkit/commit/59eefd0951c8c6fceb313e002518445296b24fdf) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: auto-generate Payload types from inline types in resolver return types

- [#103](https://github.com/izumin5210/gqlkit/pull/103) [`6501429`](https://github.com/izumin5210/gqlkit/commit/65014296069e4753d143ef323b07aaab6d0fbfdb) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: auto-generate GraphQL Union types from inline unions and `@oneOf` Input Objects from inline unions in input context

- [#129](https://github.com/izumin5210/gqlkit/pull/129) [`a2a884b`](https://github.com/izumin5210/gqlkit/commit/a2a884b544179e10b364e1d6afd420555d94291f) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: add enum prefix stripping for cleaner GraphQL enum values

- [#121](https://github.com/izumin5210/gqlkit/pull/121) [`7ae9406`](https://github.com/izumin5210/gqlkit/commit/7ae94065e4cafb3e81717e1943a7700ea23bfa35) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: add `ignoreFields` option to exclude fields from generated GraphQL schema

- [#114](https://github.com/izumin5210/gqlkit/pull/114) [`e0d093c`](https://github.com/izumin5210/gqlkit/commit/e0d093c29fa9eed74021cd81e038fd01b758f6dc) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: auto-generate `resolveType` from `__typename` and `$typeName` fields

### Patch Changes

- [#117](https://github.com/izumin5210/gqlkit/pull/117) [`0cc4e7a`](https://github.com/izumin5210/gqlkit/commit/0cc4e7ababa74c64c159303fe239358dd27bc370) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: auto-generate `resolveType` for inline unions where all members are named types with `__typename` or `$typeName` fields

- [#108](https://github.com/izumin5210/gqlkit/pull/108) [`eefdabd`](https://github.com/izumin5210/gqlkit/commit/eefdabd3e2179c209a9ccf56fc973ed96924e904) Thanks [@izumin5210](https://github.com/izumin5210)! - refactor: remove `EMPTY_TYPE_PROPERTIES` warning

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
