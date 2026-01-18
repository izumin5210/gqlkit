---
"@gqlkit-ts/cli": minor
---

pr: #95

fix: correctly preserve type alias names in schema generation

- Type alias names lost when using `Simplify<T>` pattern
- Type alias names lost when using `typeof value` pattern
- Same-named types from different sources incorrectly matched

These issues are resolved by introducing a 2-phase type extraction architecture with symbol-based comparison:

- Phase 1 collects all declared type names from schema files
- Phase 2 uses collected names during field type resolution to determine if types should be preserved or expanded
- Symbol-based type comparison enables accurate identity comparison for type alias re-exports
- Structural type detection (NoArgs, scalars, etc.) by metadata properties instead of type names
