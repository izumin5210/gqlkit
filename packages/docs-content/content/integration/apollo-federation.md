---
title: Integration with Apollo Federation
description: Generate an Apollo Federation v2 subgraph with gqlkit and compose it into a supergraph.
---

# Apollo Federation

[Apollo Federation](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation) composes several GraphQL services, called subgraphs, into one supergraph that a gateway serves. gqlkit generates an Apollo Federation v2 subgraph when `federation` is set in `gqlkit.config.ts`.

Any composition and gateway that implement Apollo Federation v2 work with the generated subgraph, for example `@theguild/federation-composition` with `@graphql-tools/federation`, or Apollo's own tools.

## Configuration

```ts
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  federation: {
    spec: "apollo-federation",
    url: "https://specs.apollo.dev/federation/v2.9",
  },
});
```

`url` selects the federation version. Pick a version that your composition and gateway support: for example, `@theguild/federation-composition` 0.27 accepts up to v2.9.

## Generated Files

With `federation`, the generated files differ in what they contain:

| File | Contents |
|------|----------|
| `schema.graphql` | The subgraph SDL to pass to composition. It starts with `extend schema @link(...)` and has no definitions of the federation directives, which composition knows from the linked spec |
| `typeDefs.ts` | The same document plus the definitions of the federation directives, so that `makeExecutableSchema` can build the subgraph, and the fields the gateway queries: `_service`, and `_entities` with `_Entity` and `_Any` when the subgraph has entities |
| `resolvers.ts` | The resolver map, wrapped with `withSubgraphResolvers` from `@gqlkit-ts/runtime/federation`, which adds the resolvers of `_service` and `_entities`. `_service { sdl }` returns the SDL of `schema.graphql` |

```graphql
# schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.9")

type Query

type User {
  id: ID!
  name: String!
}

extend type Query {
  user(id: ID!): User
}
```

A subgraph that only exposes root fields still links the federation spec, so composition treats it as a federation v2 subgraph.

## Serving a Subgraph

Build the subgraph from `typeDefs` and `resolvers` as with any gqlkit schema:

```typescript
import { createServer } from "node:http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";

const schema = makeExecutableSchema({ typeDefs, resolvers: createResolvers() });

createServer(createYoga({ schema })).listen(4001);
```

## Federation Directives

`@gqlkit-ts/runtime/federation` provides federation directives as types. Attach them with `GqlObject` and `GqlField` like custom directives, but do not define them: gqlkit takes their definitions from the federation spec, imports the ones you use with `@link`, and adds their definitions to `typeDefs.ts` only.

gqlkit recognizes these types, not the directive names. A custom `GqlDirective` named `key` stays a custom directive; with `federation` set, it is reported as `FEDERATION_DIRECTIVE_NAME_CONFLICT` only when the schema also imports `@key`. Using a federation directive without `federation` is reported as `FEDERATION_NOT_CONFIGURED`.

| Type | Directive | Where to attach |
|------|-----------|-----------------|
| `Key<Fields, Options?>` | `@key` | Object types |
| `Shareable` | `@shareable` | Object types and fields, including resolver fields |
| `Inaccessible` | `@inaccessible` | Object types, fields, arguments, and input fields |

### Entities and Keys

Declare an entity with `Key`. `Fields` is the key as a selection set without the outer braces; attach several `Key`s to declare several keys:

```typescript
import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";

export type User = GqlObject<
  { id: IDString; organization: Organization; name: string },
  { directives: [Key<"id">, Key<"organization { id }">] }
>;

// A subgraph that only references Organization, and leaves resolving it to another subgraph
export type Organization = GqlObject<
  { id: IDString },
  { directives: [Key<"id", { resolvable: false }>] }
>;
```

Generates:

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

type Organization @key(fields: "id", resolvable: false) {
  id: ID!
}

type User @key(fields: "id") @key(fields: "organization { id }") {
  id: ID!
  name: String!
  organization: Organization!
}
```

gqlkit checks each key against the type and reports `INVALID_KEY_FIELDS` when the key:

- is not a selection set
- names a field the type does not have, including the fields added with `defineField`
- selects a field that takes arguments, or uses aliases, arguments, directives, or fragments
- selects an object-typed field without selecting its fields, or selects fields of a scalar or enum
- selects a field of a union or interface type

Pruning keeps types with `Key` even when no root field reaches them, because the gateway reaches entities through the subgraph's entity resolution.

### Resolving Entities

When another subgraph references an entity, the gateway asks this subgraph for it through `_entities`, passing a reference: `__typename` and the fields of one of the entity's keys. Define how to turn a reference into the entity with `defineResolveReference` from `createFederationApis`:

```typescript
// src/gqlkit/gqlkit.ts
import { createGqlkitApis } from "@gqlkit-ts/runtime";
import { createFederationApis } from "@gqlkit-ts/runtime/federation";
import type { Context } from "./context.js";

export const { defineQuery, defineField } = createGqlkitApis<Context>();
export const { defineResolveReference } = createFederationApis<Context>();
```

```typescript
// src/gqlkit/schema/user.ts
export type User = GqlObject<
  { id: IDString; name: string },
  { directives: [Key<"id">] }
>;

export const userReference = defineResolveReference<User>((ref, ctx) =>
  ctx.users.load(ref.id),
);
```

Pass the entity type explicitly. The type of `ref` follows the entity's resolvable keys: here it is `{ readonly __typename: string } & { id: IDString }`, and an entity with several keys gets a union of one such type per key. Values in `ref` are converted as arguments are, so enum values and custom scalars arrive as your resolvers return them.

gqlkit reports:

- `INVALID_REFERENCE_RESOLVER_TARGET` when the type has no resolvable `Key` in this subgraph
- `DUPLICATE_RESOLVE_REFERENCE` when a type has more than one reference resolver
- `MISSING_REFERENCE_RESOLVER` when an entity has fields that not every key carries but no reference resolver. Without one, `_entities` returns the reference itself, which is enough only when the key fields and `defineField` resolvers cover the type

A subgraph that only references an entity declares it with its key fields and `Key<..., { resolvable: false }>`, and returns references from its fields:

```typescript
// posts subgraph
export type User = GqlObject<
  { id: IDString },
  { directives: [Key<"id", { resolvable: false }>] }
>;

export const author = defineField<Post, NoArgs, User>((post) => ({
  id: post.authorId,
}));
```

`defineResolveReference` is specific to Apollo Federation.

### Sharing and Hiding Fields

```typescript
import type { GqlField, GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Inaccessible, Shareable } from "@gqlkit-ts/runtime/federation";

// Every field of Money can be resolved by more than one subgraph
export type Money = GqlObject<
  { amount: number; currency: string },
  { directives: [Shareable] }
>;

export type Product = {
  id: IDString;
  name: GqlField<string, { directives: [Shareable] }>;
  // Hidden from the supergraph's public API
  internalCode: GqlField<string, { directives: [Inaccessible] }>;
};
```

Resolver fields take them as the directives type parameter, e.g. `defineField<Product, NoArgs, string, [Shareable]>(...)`.

## Keeping Custom Directives in the Supergraph

Composition drops the directives of a subgraph unless the subgraph marks them with `@composeDirective`. List them in `composeDirectives`, together with a URL that identifies a spec of your own:

```ts
export default defineConfig({
  federation: {
    spec: "apollo-federation",
    url: "https://specs.apollo.dev/federation/v2.9",
    composeDirectives: [
      { url: "https://example.com/redact/v1.0", import: ["@redact"] },
    ],
  },
});
```

```typescript
// src/gqlkit/schema/directives.ts
import type { GqlDirective } from "@gqlkit-ts/runtime";

/** Marks a value that must not appear in logs. */
export type RedactDirective = GqlDirective<
  "redact",
  Record<string, never>,
  ["ARGUMENT_DEFINITION", "FIELD_DEFINITION"]
>;
```

```typescript
// src/gqlkit/schema/user.ts
export const user = defineQuery<
  {
    id: IDString;
    token: GqlField<string | null, { directives: [RedactDirective] }>;
  },
  User | null
>((_root, args, ctx) => ctx.users.find(args.id));
```

Generates:

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@composeDirective"]) @link(url: "https://example.com/redact/v1.0", import: ["@redact"]) @composeDirective(name: "@redact")

directive @redact on ARGUMENT_DEFINITION | FIELD_DEFINITION

extend type Query {
  user(id: ID!, token: String @redact): User
}
```

`composeDirectives` requires federation v2.1 or later, and every listed directive must be defined with `GqlDirective`. Subgraphs that link the same spec must use the same major version in its URL.

## Composing and Running a Gateway

This example composes the subgraph SDLs at build time with `@theguild/federation-composition` and runs the supergraph with `@graphql-tools/federation`:

```typescript
import { readFileSync } from "node:fs";
import { getStitchedSchemaFromSupergraphSdl } from "@graphql-tools/federation";
import { composeServices } from "@theguild/federation-composition";
import { parse } from "graphql";

const { supergraphSdl, errors } = composeServices([
  {
    name: "users",
    typeDefs: parse(readFileSync("users/src/gqlkit/__generated__/schema.graphql", "utf-8")),
    url: "http://localhost:4001/graphql",
  },
  {
    name: "posts",
    typeDefs: parse(readFileSync("posts/src/gqlkit/__generated__/schema.graphql", "utf-8")),
    url: "http://localhost:4002/graphql",
  },
]);
if (errors?.length || !supergraphSdl) {
  throw new Error(errors?.map((e) => e.message).join("\n"));
}

const gatewaySchema = getStitchedSchemaFromSupergraphSdl({ supergraphSdl });
```

Composed directives stay on the gateway schema, so the gateway can read them, for example to mask the arguments marked with `@redact` in its logs:

```typescript
import { getDirectiveValues } from "graphql";

const redact = gatewaySchema.getDirective("redact")!;
const userArgs = gatewaySchema.getQueryType()!.getFields()["user"]!.args;
const redactedArgs = userArgs
  .filter((arg) => arg.astNode && getDirectiveValues(redact, arg.astNode))
  .map((arg) => arg.name); // ["token"]
```

See [`examples/with-apollo-federation`](https://github.com/izumin5210/gqlkit/tree/main/examples/with-apollo-federation) for a runnable setup with two subgraphs.
