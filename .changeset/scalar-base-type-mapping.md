---
"@gqlkit-ts/cli": minor
---

feat: automatic scalar mapping from GqlScalar base types

When `GqlScalar<Name, Base>` is defined, fields using the base type (e.g., `Date`) are now automatically mapped to the corresponding scalar type (e.g., `DateTime`) in the generated GraphQL schema.

Example:
```ts
// Define scalar with base type
export type DateTime = GqlScalar<"DateTime", Date>;

// Use base type directly in fields
export interface Event {
  createdAt: Date;  // Generates: createdAt: DateTime!
}
```

Features:
- Symbol-based comparison for accurate type matching across files
- Context-aware mapping (input vs output) with `GqlScalar<Name, Base, "input" | "output">` constraints
- Conflict detection when multiple scalars share the same base type
