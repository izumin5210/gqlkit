# Schema Definition

gqlkit generates GraphQL schema from your TypeScript types. All exported types from `src/gqlkit/schema/` are automatically scanned and converted to GraphQL types.

## Type Mapping

gqlkit maps TypeScript types to GraphQL types as follows:

| TypeScript | GraphQL |
|------------|---------|
| `string` | `String!` |
| `number` | `Float!` |
| `boolean` | `Boolean!` |
| `IDString`, `IDNumber` | `ID!` |
| `Int` (branded) | `Int!` |
| `Float` (branded) | `Float!` |
| `T \| null` | `T` (nullable) |
| `T[]` | `[T!]!` |
| String literal union | Enum type |
| TypeScript `enum` | Enum type |
| Union of object types | Union type |
| `*Input` suffix types | Input Object type |
| Union with `*Input` suffix | `@oneOf` input object |
| `GqlInterface<T>` | Interface type |
| `GqlScalar<Name, Base>` | Custom scalar |

## Project Layout

Default project layout:

```
src/
  gqlkit/
    schema/        # Types and resolvers co-located
    __generated__/ # Generated files (auto-created)
```

All TypeScript files (`.ts`, `.cts`, `.mts`) under `src/gqlkit/schema/` are scanned for types and resolvers.
