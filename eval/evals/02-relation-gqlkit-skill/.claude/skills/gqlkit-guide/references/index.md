# gqlkit

gqlkit generates GraphQL schema and resolver maps from TypeScript types and functions.

## How it works

1. Write TypeScript types in `src/gqlkit/schema/` → become GraphQL types
2. Write resolver functions using `defineQuery`, `defineMutation`, `defineField` → become GraphQL resolvers
3. Run `gqlkit gen` → outputs `typeDefs` and `resolvers` to `src/gqlkit/__generated__/`

## Design principles

- **Implement first**: Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.
- **Just types and functions**: Plain TypeScript with a thin API. No decorators, no complex generics.
- **Type-safe**: TypeScript types become GraphQL types. Resolver signatures checked at compile time.

## Documentation

- [What is gqlkit?](./what-is-gqlkit.md): Just types and functions — write TypeScript, generate GraphQL.
- [Getting Started](./getting-started.md): Install gqlkit and create your first GraphQL schema from TypeScript.

## Schema Definition

- [Schema Definition](./schema/conventions.md): gqlkit generates GraphQL schema from your TypeScript types.
- [Defining Object Types](./schema/objects.md): Plain TypeScript type exports become GraphQL Object types.
- [Defining Input Types](./schema/inputs.md): TypeScript types with Input suffix are treated as GraphQL input types.
- [Defining Queries and Mutations](./schema/queries-mutations.md): Define Query and Mutation fields using the @gqlkit-ts/runtime API.
- [Defining Field Resolvers](./schema/fields.md): Add computed fields to object types using defineField.
- [Defining Scalar Types](./schema/scalars.md): gqlkit provides built-in scalar types and supports custom scalar definitions.
- [Defining Enum Types](./schema/enums.md): gqlkit converts TypeScript string literal unions and enums to GraphQL enum types.
- [Defining Union Types](./schema/unions.md): TypeScript union types of object types are converted to GraphQL union types.
- [Defining Interface Types](./schema/interfaces.md): Define GraphQL interface types using the GqlInterface utility type.
- [Resolving Abstract Types](./schema/abstract-resolvers.md): Handle runtime type resolution for GraphQL unions and interfaces.
- [Adding Documentation to Schema](./schema/documentation.md): gqlkit extracts TSDoc/JSDoc comments and converts them to GraphQL descriptions.
- [Defining Custom Directives](./schema/directives.md): Define custom directives using the GqlDirective utility type.

## Integration

- [Integration with graphql-yoga](./integration/yoga.md): Use gqlkit with graphql-yoga, a batteries-included GraphQL server.
- [Integration with Apollo Server](./integration/apollo.md): Use gqlkit with Apollo Server, a popular GraphQL server.
- [Integration with Drizzle ORM](./integration/drizzle.md): Derive GraphQL types from Drizzle table definitions.
- [Integration with Prisma](./integration/prisma.md): Derive GraphQL types from Prisma model types.

## Guides

- [Configuration](./configuration.md): Configure gqlkit via gqlkit.config.ts in your project root.
- [Coding Agents](./coding-agents.md): Set up AI coding agents like Claude Code and Codex to understand gqlkit conventions. (skip if reading via `gqlkit-guide` skill)
