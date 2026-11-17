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
| `typeDefs.ts` | The same document plus the definitions of the federation directives, so that `makeExecutableSchema` can build the subgraph |
| `resolvers.ts` | Unchanged |

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
