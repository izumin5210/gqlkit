# Utility Types Reference

gqlkit provides utility types for advanced GraphQL features.

## GqlInterface

Define GraphQL interface types:

```typescript
import { GqlInterface } from "@gqlkit-ts/runtime";

export type Node = GqlInterface<{
  id: string;
}>;

export type User = {
  id: string;
  name: string;
} & Node;
```

## GqlObject

Add metadata to types (implements, directives):

```typescript
import { GqlObject } from "@gqlkit-ts/runtime";

type UserType = {
  id: string;
  name: string;
};

export type User = GqlObject<UserType, { implements: [Node] }>;
```

## GqlField

Add metadata to fields (defaultValue, directives):

```typescript
import { GqlField } from "@gqlkit-ts/runtime";

export type CreateUserInput = {
  name: string;
  role: GqlField<string, { defaultValue: "USER" }>;
};
```

## GqlScalar

Define custom scalar types:

```typescript
import { GqlScalar } from "@gqlkit-ts/runtime";

export type DateTime = GqlScalar<"DateTime", string>;
export type JSON = GqlScalar<"JSON", unknown>;
```

## GqlDirective

Define custom directives:

```typescript
import { GqlDirective } from "@gqlkit-ts/runtime";

export type Deprecated = GqlDirective<
  "deprecated",
  { reason?: string },
  "FIELD_DEFINITION"
>;
```

## NoArgs

Helper type for resolvers without arguments:

```typescript
import { NoArgs } from "@gqlkit-ts/runtime";

export const users = defineQuery<NoArgs, User[]>(
  (root, args, ctx) => ctx.db.findAllUsers()
);
```
