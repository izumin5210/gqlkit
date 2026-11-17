---
title: Schema Definition
description: gqlkit generates GraphQL schema from your TypeScript types.
---

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
| `NoArgs` | Indicates resolver takes no arguments |

## Naming Conventions

gqlkit generates type names using predictable conventions:

For `defineQuery`, `defineMutation`, and `defineField`, GraphQL field names are also derived from exported variable names:

- Default: the full export name is used as-is.
- If the export name contains `$`, gqlkit uses the substring after the last `$`.
- Common usage is a single prefix (for example, `Query$users` -> `users`).
- If the export name ends with `$`, gqlkit reports an error.

| Context | Pattern | Example |
|---------|---------|---------|
| Object field (inline) | `{ParentType}{Field}` | `User.profile` → `UserProfile` |
| Input field (inline) | `{ParentWithoutInput}{Field}Input` | `CreateUserInput.address` → `CreateUserAddressInput` |
| Query/Mutation arg | `{Resolver}{Arg}Input` | `searchUsers(filter)` → `SearchUsersFilterInput` |
| Field resolver arg | `{Parent}{Field}{Arg}Input` | `User.posts(filter)` → `UserPostsFilterInput` |
| Inline enum | Same as parent context | `User.status` → `UserStatus` |
| Payload type | `{Resolver}Payload` | `updateUser` → `UpdateUserPayload` |

For complete details on inline enum naming, see [Inline Enums](./enums.md#inline-enums).

### Types that are not exported

A named type that is not exported still becomes a GraphQL type when a schema type's field or a resolver's argument or return type references it. It keeps its TypeScript name, except where it is used as an input: there it becomes an input type named `{Name}Input` (or `{Name}` if the name already ends with `Input`).

```ts
interface Filter {
  keyword: string;
}

interface Item {
  name: string;
}

export const search = defineQuery<{ filter: Filter }, Item[]>(() => []);
```

```graphql
type Item {
  name: String!
}

input FilterInput {
  keyword: String!
}

extend type Query {
  search(filter: FilterInput!): [Item!]!
}
```

If `{Name}Input` is already the name of a declared type, gqlkit reports an error.

## Project Layout

Default project layout:

```
src/
  gqlkit/
    schema/        # Types and resolvers co-located
    __generated__/ # Generated files (auto-created)
```

All TypeScript files (`.ts`, `.cts`, `.mts`) under `src/gqlkit/schema/` are scanned for types and resolvers.
