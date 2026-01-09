# Evaluation Criteria

Detailed evaluation criteria for golden test case review.

## 1. Naming Appropriateness

### Good Examples

| Name | Why Good |
|------|----------|
| `interface-basic` | Clear category + scope |
| `directive-deprecated` | Specific directive type |
| `scalar-config-global-type` | Specific configuration scenario |
| `default-value-complex` | Indicates complexity level |

### Bad Examples

| Name | Issue | Suggested Fix |
|------|-------|---------------|
| `test1` | No semantic meaning | Use descriptive name |
| `misc` | Too vague | Split into specific cases |
| `DirectiveTest` | Not kebab-case | `directive-test` |
| `basic-object-type-with-query-and-mutation` | Too long | Split into multiple cases |

## 2. Source Code Quality

### Minimal Code Principle

Each test case should contain only the minimum code needed to test the specific feature.

**Good Example** (testing interface implementation):
```typescript
export interface Node {
  id: string;
}

export interface User extends Node {
  name: string;
}
```

**Bad Example** (too much irrelevant code):
```typescript
export interface Node {
  id: string;
}

export interface User extends Node {
  name: string;
  email: string;
  createdAt: Date;
  posts: Post[];
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author: User;
}
```

### gqlkit Conventions

Verify proper usage of gqlkit APIs:

```typescript
// Query/Mutation resolvers
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();

export const users = defineQuery<NoArgs, User[]>(() => []);
export const createUser = defineMutation<CreateUserArgs, User>((_, args) => ...);

// Field resolvers
export const posts = defineField<User, NoArgs, Post[]>((parent) => ...);
```

## 3. Type Completeness

### Checking Exported Types

For each source file, identify all exported types:

```typescript
// src/gqlkit/schema/types.ts
export interface User { ... }     // Should appear in schema
export type Status = "A" | "B";   // Should appear as enum or union
export interface Post { ... }     // Should appear in schema

interface Internal { ... }        // Not exported, should NOT appear
```

### Verification Method

1. List all `export interface` and `export type` declarations
2. List all types in schema.graphql
3. Compare lists - every exported type should be present

### Common Issues

| Issue | Example |
|-------|---------|
| Missing type | Exported `Post` interface not in schema |
| Extra type | Internal type appearing in schema |
| Wrong name | `UserInput` exported but `CreateUserInput` in schema |

## 4. Type Conversion Accuracy

### Nullability Rules

| TypeScript | GraphQL | Notes |
|------------|---------|-------|
| `string` | `String!` | Non-null |
| `string \| null` | `String` | Nullable |
| `string \| undefined` | `String` | Treated as nullable |
| `string?` | `String` | Optional = nullable |

### Array Rules

| TypeScript | GraphQL | Notes |
|------------|---------|-------|
| `T[]` | `[T!]!` | Non-null array of non-null items |
| `T[] \| null` | `[T!]` | Nullable array of non-null items |
| `(T \| null)[]` | `[T]!` | Non-null array of nullable items |
| `(T \| null)[] \| null` | `[T]` | Nullable array of nullable items |

### Common Conversion Errors

| Error | TypeScript | Expected GraphQL | Actual GraphQL |
|-------|------------|------------------|----------------|
| Missing nullability | `string \| null` | `String` | `String!` |
| Wrong array | `T[]` | `[T!]!` | `[T]` |
| Extra nullability | `string` | `String!` | `String` |

## 5. resolvers.ts Accuracy

### Expected Structure

```typescript
export const resolvers = {
  Query: {
    users: queryResolvers.users,
    user: queryResolvers.user,
  },
  Mutation: {
    createUser: mutationResolvers.createUser,
  },
  User: {
    posts: fieldResolvers.posts,
  },
};
```

### Verification Checklist

- [ ] All Query resolvers exported from schema files are included
- [ ] All Mutation resolvers exported from schema files are included
- [ ] All Field resolvers are under correct parent type
- [ ] No duplicate entries
- [ ] No missing entries
- [ ] Import paths are correct

## 6. diagnostics.json Accuracy

### Error Case Structure

```json
[
  {
    "code": "UNRESOLVED_REFERENCE",
    "message": "Field 'id' references unresolved type 'unknown'",
    "severity": "error",
    "location": {
      "file": "src/gqlkit/schema/bad.ts",
      "line": 1,
      "column": 1
    }
  }
]
```

### Common Error Codes

| Code | Description | Example |
|------|-------------|---------|
| `UNRESOLVED_REFERENCE` | Referenced type not found | Unknown type in field |
| `DUPLICATE_DEFINITION` | Same name defined twice | Two `User` types |
| `INVALID_DIRECTIVE` | Invalid directive usage | Wrong directive location |
| `TYPE_MISMATCH` | Resolver type mismatch | Return type doesn't match |

### Verification

For error test cases:
- Error code is appropriate for the scenario
- Message clearly explains the issue
- Location points to correct file/line
- Severity matches the issue type

For normal test cases:
- diagnostics.json contains empty array `[]`

## 7. MECE Property

### Avoiding Overlap

Each test case should test one specific feature. Overlap examples to avoid:

| Case A | Case B | Issue |
|--------|--------|-------|
| `interface-basic` | `interface-inheritance` | Both test basic interface |
| `directive-basic` | `directive-deprecated` | deprecated should be separate |

### Ensuring Completeness

For each category, verify all sub-features are covered:

**Interface category checklist**:
- [ ] Basic interface definition
- [ ] Interface inheritance (extends)
- [ ] Multiple interface implementation
- [ ] Circular references
- [ ] Interface with resolvers
- [ ] Missing field errors

**Directive category checklist**:
- [ ] Basic directive usage
- [ ] Multiple directives
- [ ] Directive with arguments
- [ ] Deprecated directive
- [ ] Custom directive definition
- [ ] Invalid directive errors

## 8. Rating Guidelines

### ✅ Good

- Fully meets all criteria
- No issues found
- Clean implementation

### ⚠️ Warning

- Minor issues that don't affect functionality
- Room for improvement
- Examples:
  - Slightly verbose source code
  - Non-ideal naming
  - Missing edge case

### ❌ Error

- Functional issues
- Incorrect output
- Missing required elements
- Examples:
  - Type not reflected in schema
  - Wrong error diagnostic
  - Resolver missing from resolvers.ts
