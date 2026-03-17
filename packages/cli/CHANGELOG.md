# @gqlkit-ts/cli

## 0.7.2

### Patch Changes

- [#233](https://github.com/izumin5210/gqlkit/pull/233) [`a61bfe5`](https://github.com/izumin5210/gqlkit/commit/a61bfe5efa77e5014f72966870dbae14e8cbba68) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: resolve GqlObject property types in inline payloads as references

## 0.7.1

### Patch Changes

- [#227](https://github.com/izumin5210/gqlkit/pull/227) [`1656c9e`](https://github.com/izumin5210/gqlkit/commit/1656c9e709d01bdbfbaf7fe717a3ed3510f32b1e) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: resolve nullable union type alias (`T | null` where T is a union) as a reference instead of an inline union

- [#230](https://github.com/izumin5210/gqlkit/pull/230) [`f4a9695`](https://github.com/izumin5210/gqlkit/commit/f4a96955ed578fb2d59592b4d63c8b0d34ee6d19) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: collect types from specifier-level type-only re-exports (`export { type Foo } from "..."`)

## 0.7.0

### Minor Changes

- [#207](https://github.com/izumin5210/gqlkit/pull/207) [`b6fb6c1`](https://github.com/izumin5210/gqlkit/commit/b6fb6c138d9cc6f6ecba09dbc828a3c30e208a19) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: support custom discriminator fields for union type resolution

- [#209](https://github.com/izumin5210/gqlkit/pull/209) [`42a5fff`](https://github.com/izumin5210/gqlkit/commit/42a5fff9d8c29d0b5d107c63e2dc6129b779c65b) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: flatten intersection-expanded union members for discriminator fields

- [#218](https://github.com/izumin5210/gqlkit/pull/218) [`9ed4962`](https://github.com/izumin5210/gqlkit/commit/9ed49626424b0870709e7076265f3641b0328ca6) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: map `unknown` to `JSON` and index signatures to `JSONObject` scalar

### Patch Changes

- [#213](https://github.com/izumin5210/gqlkit/pull/213) [`21fa614`](https://github.com/izumin5210/gqlkit/commit/21fa61402971dd251ae2d160075b91471da706a8) Thanks [@izumin5210](https://github.com/izumin5210)! - docs: add Vercel AI SDK integration guide

- [#204](https://github.com/izumin5210/gqlkit/pull/204) [`d462e79`](https://github.com/izumin5210/gqlkit/commit/d462e7926b9405a4d6854fa34ecf906131316d36) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: preserve original type names for external .d.ts types used as union members

- [#192](https://github.com/izumin5210/gqlkit/pull/192) [`eed52d2`](https://github.com/izumin5210/gqlkit/commit/eed52d2ce527d955abc94d607cde1b06d597c9ac) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: discover and register non-exported union member types with original names

- [#194](https://github.com/izumin5210/gqlkit/pull/194) [`ee06751`](https://github.com/izumin5210/gqlkit/commit/ee06751fb1941212e3c31f7df6166edea4666e71) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: add type annotation to auto-generated resolveType parameter

- [#223](https://github.com/izumin5210/gqlkit/pull/223) [`61af8ef`](https://github.com/izumin5210/gqlkit/commit/61af8effd73c2fc1f82e5949f83d7af646d65843) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: detect custom scalars inside inline object properties

- [#212](https://github.com/izumin5210/gqlkit/pull/212) [`0d102f2`](https://github.com/izumin5210/gqlkit/commit/0d102f2e885fdf3284f6b52ead5ef27a1a40953e) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: apply discriminator-aware flattening to inline unions

- [#219](https://github.com/izumin5210/gqlkit/pull/219) [`1281654`](https://github.com/izumin5210/gqlkit/commit/1281654592f2b2b90680e0034822f65dc00a3f55) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: register intersection type aliases in discoveredTypes for recursive resolution

- [#189](https://github.com/izumin5210/gqlkit/pull/189) [`28b6214`](https://github.com/izumin5210/gqlkit/commit/28b6214b0592d58961e35ec70238a8ebb82499b4) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: skip fields with `never` type during schema generation

- [#216](https://github.com/izumin5210/gqlkit/pull/216) [`248a06e`](https://github.com/izumin5210/gqlkit/commit/248a06e1f1d2841012793eec9ac8a3c1a65b946e) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: filter `__object` internal symbol from generated schema

- [#193](https://github.com/izumin5210/gqlkit/pull/193) [`d53a940`](https://github.com/izumin5210/gqlkit/commit/d53a94014c8fb5158e6db0c6bb7a37e456af9968) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: resolve `defineResolveType` with auto-generated inline union names

- [#220](https://github.com/izumin5210/gqlkit/pull/220) [`55e096a`](https://github.com/izumin5210/gqlkit/commit/55e096a1e7ea19732850a955800b2571675f5111) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: prevent false-positive cycle detection for shared inline types

- [#225](https://github.com/izumin5210/gqlkit/pull/225) [`4c8a3cc`](https://github.com/izumin5210/gqlkit/commit/4c8a3cccbf645ecc85686c5bbc2522f754fd9dbb) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: preserve enum prefix stripping for singularized arrays

- [#190](https://github.com/izumin5210/gqlkit/pull/190) [`01c09ee`](https://github.com/izumin5210/gqlkit/commit/01c09ee46fbd1d55572742ebe34b42c8ecc47378) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: map string/number literal fields to GraphQL scalar types

- [#191](https://github.com/izumin5210/gqlkit/pull/191) [`507ce4b`](https://github.com/izumin5210/gqlkit/commit/507ce4bc297e5b615b6eb9bbf2f9e10b8357daaa) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: map template literal types to String! in GraphQL schema

- [#203](https://github.com/izumin5210/gqlkit/pull/203) [`958d4b0`](https://github.com/izumin5210/gqlkit/commit/958d4b0a5b0692d0a404ac19c204273d930cb14a) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: discover type aliases transitively in union members

- [#195](https://github.com/izumin5210/gqlkit/pull/195) [`2b11608`](https://github.com/izumin5210/gqlkit/commit/2b11608d26cca9816e8379662af9c9c24da27e6e) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: suppress warnings for typename discrimination fields

- [#205](https://github.com/izumin5210/gqlkit/pull/205) [`38f3875`](https://github.com/izumin5210/gqlkit/commit/38f3875e9c3b3aeee4ef13ea8bd36d920e6722fa) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: replace `member${i}` index-based naming fallback with `UNNAMEABLE_UNION_MEMBER` diagnostic error

## 0.6.0

### Minor Changes

- [#182](https://github.com/izumin5210/gqlkit/pull/182) [`b0d6621`](https://github.com/izumin5210/gqlkit/commit/b0d6621a72da6e167c75f0f0617854924897dd9e) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: add GraphQL Subscription support

- [#163](https://github.com/izumin5210/gqlkit/pull/163) [`337b5b1`](https://github.com/izumin5210/gqlkit/commit/337b5b199212face22e15e899ee2be9f4ea7dd00) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: support $ delimiter in resolver export names

### Patch Changes

- [#183](https://github.com/izumin5210/gqlkit/pull/183) [`da9277b`](https://github.com/izumin5210/gqlkit/commit/da9277b6c1b038ea82276501315cb0ceaa33afa0) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: skip reserved field names in resolver extraction path

## 0.5.1

### Patch Changes

- [#147](https://github.com/izumin5210/gqlkit/pull/147) [`5fc46f3`](https://github.com/izumin5210/gqlkit/commit/5fc46f34bbda12c00ae1832a782f3e51631e7481) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: detect and report errors when the same type name is exported from multiple files

## 0.5.0

### Minor Changes

- [#141](https://github.com/izumin5210/gqlkit/pull/141) [`0ef5d25`](https://github.com/izumin5210/gqlkit/commit/0ef5d259bff256cf7d3e37a00c5a7ed037bd6f49) Thanks [@izumin5210](https://github.com/izumin5210)! - feat: add --config option to specify config file path

### Patch Changes

- [#144](https://github.com/izumin5210/gqlkit/pull/144) [`066f788`](https://github.com/izumin5210/gqlkit/commit/066f78897c746f2978deff7e1708f75ffbf10675) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: resolve import name conflicts when same export name exists in multiple files

## 0.4.1

### Patch Changes

- [#138](https://github.com/izumin5210/gqlkit/pull/138) [`d7fb677`](https://github.com/izumin5210/gqlkit/commit/d7fb6770c4ad8aabaa68c8436527d1a5f0c48906) Thanks [@izumin5210](https://github.com/izumin5210)! - fix: improve docs symlink to discover node_modules by walking up directories

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
