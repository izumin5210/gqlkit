---
"@gqlkit-ts/cli": minor
---

feat: 2-phase type extraction with symbol-based comparison ([#95](https://github.com/izumin5210/gqlkit/pull/95))

Introduces a robust 2-phase type extraction architecture to correctly handle type aliases and distinguish same-named types from different sources.

**Key improvements:**
- Phase 1 collects all declared type names from schema files
- Phase 2 uses collected names during field type resolution to determine if types should be preserved or expanded
- Symbol-based type comparison enables accurate identity comparison for type alias re-exports
- Structural type detection (NoArgs, scalars, etc.) by metadata properties instead of type names

**Fixed issues:**
- Type alias names lost when using `Simplify<T>` pattern
- Type alias names lost when using `typeof value` pattern
- Same-named types from different sources incorrectly matched
