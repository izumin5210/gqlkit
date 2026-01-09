---
name: golden-test-reviewer
description: This skill should be used when the user asks to "review golden test", "evaluate testcase", "check testdata quality", "review test coverage", or wants to validate golden test cases in packages/cli/src/gen-orchestrator/testdata/. Provides systematic evaluation workflow for gqlkit golden test cases.
---

# Golden Test Reviewer

Skill for reviewing and evaluating gqlkit golden test cases.

## Purpose

Systematically evaluate golden test cases under `packages/cli/src/gen-orchestrator/testdata/`, identify issues, and provide concrete fix suggestions.

## Workflow

### Step 1: Select Review Target

When the review target is not explicitly specified, use AskUserQuestion to present the following options:

1. **All**: Review all test cases
2. **Category**: Review test cases in a specific category only
   - Basic types (`basic-*`)
   - Scalars (`scalar-*`, `branded-scalar`)
   - Directives (`directive-*`, `deprecated-*`)
   - Interfaces (`interface-*`)
   - Unions (`union-*`)
   - Input types (`input-*`, `oneof-*`)
   - Default values (`default-value-*`)
   - Errors (`*-errors`, `type-error-*`)
3. **Diff**: Review only test cases with changes between current branch and default branch (main)

#### Getting Changed Test Cases

```bash
# Get test cases with changes
git diff main --name-only -- packages/cli/src/gen-orchestrator/testdata/ | \
  sed 's|packages/cli/src/gen-orchestrator/testdata/||' | \
  cut -d'/' -f1 | sort -u
```

### Step 2: Understand Test Case Structure

Each test case has the following structure:

```
testdata/{test-case-name}/
├── tsconfig.json
└── src/gqlkit/
    ├── schema/          # Source TypeScript files to analyze
    └── __generated__/   # Generated golden files
        ├── diagnostics.json   # Errors/warnings
        ├── resolvers.ts       # Resolver map
        ├── schema.graphql     # Generated GraphQL schema
        └── typeDefs.ts        # GraphQL AST
```

### Step 3: Evaluate Each Test Case

Evaluate each test case from the following perspectives:

#### 3.1 Naming Appropriateness

Verify the test case name:
- Accurately represents the feature being tested
- Distinguishable from other test cases
- Uses kebab-case
- Has a clear category prefix (e.g., `directive-*`, `scalar-*`, `interface-*`)

#### 3.2 Source Code Quality

For files in `src/gqlkit/schema/`:
- Expresses the tested feature with minimal code
- No unnecessary definitions or complexity
- Follows gqlkit conventions (`defineQuery`, `defineMutation`, `defineField`)

#### 3.3 schema.graphql Accuracy

Verify consistency between TypeScript types and generated GraphQL schema:

**Type Completeness (Coverage of Exported Types)**:
- All exported TypeScript types are reflected in schema.graphql
- No missing types

**Type Conversion Accuracy**:
- `T | null` → nullable field
- `T[]` → `[T!]!`
- `(T | null)[]` → `[T]!`
- `T[] | null` → `[T!]`

**Other Checks**:
- Directives are correctly applied
- Descriptions are correctly reflected

#### 3.4 resolvers.ts Accuracy

- All defined resolvers are included
- Type hierarchy is correctly reflected
- No unnecessary resolvers included

#### 3.5 diagnostics.json Accuracy

- Error cases output appropriate errors
- Normal cases have empty array `[]`
- Error codes, messages, and locations are accurate
- Appropriate severity (error/warning) is set

#### 3.6 MECE Property (Mutually Exclusive, Collectively Exhaustive)

- No feature overlap with other test cases
- Related features are fully covered
- Edge cases are appropriately covered

### Step 4: Output Review Results

Create a report for each test case in the following format:

```markdown
## {test-case-name}

### Overview
- Purpose: {Description of tested feature}
- Source files: {File list}
- Exported types: {Type list}

### Evaluation Results

| Aspect | Rating | Comments |
|--------|--------|----------|
| Naming | ✅/⚠️/❌ | {comments} |
| Source quality | ✅/⚠️/❌ | {comments} |
| Type completeness | ✅/⚠️/❌ | {comments} |
| Type conversion | ✅/⚠️/❌ | {comments} |
| resolvers.ts | ✅/⚠️/❌ | {comments} |
| diagnostics.json | ✅/⚠️/❌ | {comments} |
| MECE property | ✅/⚠️/❌ | {comments} |

### Issues and Fix Suggestions
{Provide concrete fix suggestions if issues exist}
```

## Evaluation Ratings

- ✅ **Good**: No issues
- ⚠️ **Warning**: Room for improvement (functionally correct)
- ❌ **Error**: Fix required

## Test Case Categories

| Category | Prefix | Description |
|----------|--------|-------------|
| Basic types | `basic-*` | Basic object types |
| Scalars | `scalar-*`, `branded-scalar` | Custom scalar types |
| Directives | `directive-*`, `deprecated-*` | GraphQL directives |
| Interfaces | `interface-*` | Interface types |
| Unions | `union-*` | Union types |
| Input types | `input-*`, `oneof-*` | Input object types |
| Default values | `default-value-*` | Argument default values |
| Resolvers | `field-resolver` | Field resolvers |
| Errors | `*-errors`, `type-error-*` | Error detection |
| Documentation | `tsdoc-*` | Description from TSDoc |

## Additional Resources

### Reference Files

For detailed evaluation criteria, see:
- **`references/evaluation-criteria.md`** - Detailed criteria and judgment examples
- **`references/testcase-structure.md`** - Test case structure and conventions
