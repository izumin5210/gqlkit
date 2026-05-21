# 02-relation — graphql-codegen

Extend the 01-crud schema with relations between `User` and `Post`, implemented
using **[graphql-codegen](https://the-guild.dev/graphql/codegen)**.

## Domain

Backing types (provided in `src/db/schema.ts`) are unchanged. `src/db/` also
exposes a `Context` type used as the GraphQL resolver context.

## GraphQL surface

All operations from 01-crud, **plus**:

- `User.posts: [Post!]!`
- `Post.author: User!`

The reference query the API must support:

```graphql
query {
  users { id name posts { id title } }
}
```

## Constraints

- **`User.email` MUST NOT be exposed**.
- `Post.internalNotes` is irrelevant — leave it off GraphQL entirely.
