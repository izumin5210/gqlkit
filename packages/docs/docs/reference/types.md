# Type Mapping Reference

## TypeScript to GraphQL Mapping

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

## Branded Types

Import branded types from `@gqlkit-ts/runtime`:

```typescript
import { IDString, IDNumber, Int, Float } from "@gqlkit-ts/runtime";

export type User = {
  id: IDString;      // ID!
  age: Int;          // Int!
  score: Float;      // Float!
};
```
