# 01-crud — graphql-codegen

Implement a GraphQL API for a tiny `User` / `Post` system in TypeScript using
**[graphql-codegen](https://the-guild.dev/graphql/codegen)**.

## Domain

```ts
// Backing types — already provided in src/db/schema.ts
type DbUser = { id: string; name: string; email: string; createdAt: Date };
type DbPost = {
  id: string; title: string; body: string; authorId: string;
  internalNotes: string;
  priority: "low" | "medium" | "high";
  createdAt: Date;
};
```

GraphQL surface:

- `Query.users: [User!]!`
- `Query.user(id: ID!): User`
- `Query.posts: [Post!]!`
- `Mutation.createUser(input: CreateUserInput!): User!`
- `Mutation.createPost(input: CreatePostInput!): Post!`
- `Mutation.updatePost(input: UpdatePostInput!): Post!`
- `Mutation.deletePost(id: ID!): Boolean!`

`src/db/` also exposes a `Context` type used as the GraphQL resolver context.

## Constraints

- **`User.email` MUST NOT be exposed** in the GraphQL schema (sensitive).
- `Post.internalNotes` is irrelevant — leave it off GraphQL entirely.
