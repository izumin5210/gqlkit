---
title: Defining Subscriptions
description: Define Subscription fields using the @gqlkit-ts/runtime API.
---

# Subscriptions

Define Subscription fields using the `@gqlkit-ts/runtime` API.

> **Prerequisites**: This guide assumes you have completed the [basic setup](../getting-started.md#set-up-context-and-resolver-factories).

## Setup

Export `defineSubscription` from your `gqlkit.ts`:

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context";

export const { defineQuery, defineMutation, defineSubscription } =
  createGqlkitApis<Context>();
```

## Subscription Resolvers

Use `defineSubscription` to define Subscription fields. The resolver function must return an `AsyncIterable` (or `Promise<AsyncIterable>`):

```typescript
import { defineSubscription } from "../gqlkit";
import type { Message } from "./message";

// Subscription.messageAdded(channelId: String!)
export const messageAdded = defineSubscription<
  { channelId: string },
  Message
>(async (_root, args, ctx) => {
  return ctx.pubsub.subscribe("MESSAGE_ADDED", args.channelId);
});
```

Generates:

```graphql
type Subscription {
  messageAdded(channelId: String!): Message!
}
```

The same export name conventions apply as with [Queries & Mutations](./queries-mutations.md):

```typescript
// GraphQL field name: messageAdded
export const Subscription$messageAdded = defineSubscription<
  { channelId: string },
  Message
>(async (_root, args, ctx) => {
  return ctx.pubsub.subscribe("MESSAGE_ADDED", args.channelId);
});
```

## NoArgs Subscriptions

Use `NoArgs` for subscriptions without arguments:

```typescript
import { defineSubscription } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";

// Subscription.heartbeat
export const heartbeat = defineSubscription<NoArgs, { timestamp: string }>(
  async () => {
    return (async function* () {
      while (true) {
        yield { timestamp: new Date().toISOString() };
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
  }
);
```

## Resolver Function Signature

Subscription resolvers receive the same four arguments as Query/Mutation resolvers, but return an `AsyncIterable` instead of a direct value:

```typescript
(root, args, ctx, info) => AsyncIterable<T> | Promise<AsyncIterable<T>>
```

| Argument | Description |
|----------|-------------|
| `root` | The root value (always undefined) |
| `args` | The arguments passed to the field |
| `ctx` | The context object (typed via `createGqlkitApis<Context>()`) |
| `info` | GraphQL resolve info |

## Generated Resolver Map

gqlkit wraps each subscription resolver in the `{ subscribe: fn }` format required by GraphQL execution engines:

```typescript
// Generated resolvers.ts
export const resolvers = {
  Subscription: {
    messageAdded: { subscribe: messageAdded },
    heartbeat: { subscribe: heartbeat },
  },
};
```

## Inline Object Arguments

Subscription arguments support the same inline object types as queries and mutations:

```typescript
export const orderUpdated = defineSubscription<
  {
    filter: {
      orderId: string | null;
      status: string | null;
    };
  },
  Order
>(async (_root, args, ctx) => {
  return ctx.pubsub.subscribe("ORDER_UPDATED", args.filter);
});
```

Generates:

```graphql
type Subscription {
  orderUpdated(filter: OrderUpdatedFilterInput!): Order!
}

input OrderUpdatedFilterInput {
  orderId: String
  status: String
}
```

## Attaching Directives

Add a third type parameter to attach directives:

```typescript
import { defineSubscription } from "../gqlkit";
import type { AuthDirective } from "./directives";
import type { Message } from "./message";

export const messageAdded = defineSubscription<
  { channelId: string },
  Message,
  [AuthDirective<{ role: ["USER"] }>]
>(async (_root, args, ctx) => {
  return ctx.pubsub.subscribe("MESSAGE_ADDED", args.channelId);
});
```

Generates:

```graphql
type Subscription {
  messageAdded(channelId: String!): Message! @auth(role: [USER])
}
```

See [Directives](./directives.md) for more details on defining and using custom directives.

## Documentation

TSDoc comments on subscription exports are extracted as GraphQL descriptions:

```typescript
/** Subscribe to new messages in a channel. */
export const messageAdded = defineSubscription<
  { channelId: string },
  Message
>(async (_root, args, ctx) => {
  return ctx.pubsub.subscribe("MESSAGE_ADDED", args.channelId);
});

/**
 * @deprecated Use messageAdded instead.
 */
export const onMessage = defineSubscription<
  { channelId: string },
  Message
>(async (_root, args, ctx) => {
  return ctx.pubsub.subscribe("MESSAGE_ADDED", args.channelId);
});
```

Generates:

```graphql
type Subscription {
  """Subscribe to new messages in a channel."""
  messageAdded(channelId: String!): Message!
  onMessage(channelId: String!): Message! @deprecated(reason: "Use messageAdded instead.")
}
```

See [Documentation](./documentation.md) for more details.
