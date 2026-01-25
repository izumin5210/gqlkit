---
"@gqlkit-ts/runtime": minor
"@gqlkit-ts/cli": minor
---

feat: add ignoreFields support for excluding fields from GraphQL schema

Add the ability to exclude specific fields from the generated GraphQL schema using the `ignoreFields` metadata option on `GqlObject` types. This is useful for internal fields that should not be exposed in the public API.

```typescript
type User = GqlObject<
  {
    id: IDString;
    name: string;
    internalId: string;
  },
  { ignoreFields: "internalId" }
>;
```

Features:
- Works with both Object Types and Input Object Types
- Type-safe: TypeScript errors for non-existent field names
- Compatible with `directives` and `implements` options
- Validation errors for unknown fields or excluding all fields
