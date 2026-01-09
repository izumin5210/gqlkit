# Subagent Prompt Template

Prompt template for evaluating individual golden test cases. Replace `{test-case-name}` with the actual test case name.

---

Review the golden test case "{test-case-name}" located at:
packages/cli/src/gen-orchestrator/testdata/{test-case-name}/

## Your Task

1. Read all files in the test case directory
2. Evaluate the test case against the criteria below
3. Return a structured evaluation result

## Test Case Structure

- `src/gqlkit/schema/` - Source TypeScript files (input)
- `src/gqlkit/__generated__/` - Golden files (expected output)
  - `diagnostics.json` - Errors/warnings
  - `resolvers.ts` - Resolver map
  - `schema.graphql` - Generated GraphQL schema
  - `typeDefs.ts` - GraphQL AST

## Evaluation Criteria

### 1. Naming Appropriateness

- Accurately represents the feature being tested
- Distinguishable from other test cases
- Uses kebab-case
- Has a clear category prefix (e.g., `directive-*`, `scalar-*`, `interface-*`)

**Good Examples**: `interface-basic`, `directive-deprecated`, `scalar-config-global-type`
**Bad Examples**: `test1`, `misc`, `DirectiveTest`

### 2. Source Code Quality

For files in `src/gqlkit/schema/`:
- Expresses the tested feature with minimal code
- No unnecessary definitions or complexity
- Follows gqlkit conventions:
  - `createGqlkitApis<Context>()` for resolver factory
  - `defineQuery<Args, Return>` for Query resolvers
  - `defineMutation<Args, Return>` for Mutation resolvers
  - `defineField<Parent, Args, Return>` for field resolvers

### 3. schema.graphql Accuracy

Verify consistency between TypeScript types and generated GraphQL schema:

**Type Completeness**:
- All exported TypeScript types are reflected in schema.graphql
- No missing types, no extra types

**Type Conversion Rules**:
| TypeScript | GraphQL |
|------------|---------|
| `string` | `String!` |
| `string \| null` | `String` |
| `T[]` | `[T!]!` |
| `T[] \| null` | `[T!]` |
| `(T \| null)[]` | `[T]!` |
| `(T \| null)[] \| null` | `[T]` |

**Other Checks**:
- Directives are correctly applied
- TSDoc/JSDoc comments become GraphQL descriptions
- `@deprecated` directive is correctly applied

### 4. resolvers.ts Accuracy

- All Query resolvers exported from schema files are included
- All Mutation resolvers exported from schema files are included
- All Field resolvers are under correct parent type
- No duplicate entries, no missing entries
- Import paths are correct

### 5. diagnostics.json Accuracy

**For normal cases**:
- Contains empty array `[]`

**For error cases**:
- Appropriate error code for the scenario
- Message clearly explains the issue
- Location points to correct file/line/column
- Severity (error/warning) matches the issue type

### 6. MECE Property (Mutually Exclusive, Collectively Exhaustive)

- No feature overlap with other test cases
- Each test case tests one specific feature
- Related features are fully covered
- Edge cases are appropriately covered

## Output Format

Return your evaluation in this exact JSON format:

```json
{
  "testCase": "{test-case-name}",
  "overview": {
    "purpose": "Brief description of what this test case validates",
    "sourceFiles": ["list", "of", "source", "files"],
    "exportedTypes": ["list", "of", "exported", "types"]
  },
  "ratings": {
    "naming": { "rating": "good|warning|error", "comment": "..." },
    "sourceQuality": { "rating": "good|warning|error", "comment": "..." },
    "typeCompleteness": { "rating": "good|warning|error", "comment": "..." },
    "typeConversion": { "rating": "good|warning|error", "comment": "..." },
    "resolversTs": { "rating": "good|warning|error", "comment": "..." },
    "diagnosticsJson": { "rating": "good|warning|error", "comment": "..." },
    "meceProperty": { "rating": "good|warning|error", "comment": "..." }
  },
  "issues": [
    { "severity": "error|warning", "description": "...", "suggestion": "..." }
  ]
}
```

## Rating Guidelines

- **good**: Fully meets all criteria, no issues found
- **warning**: Minor issues that don't affect functionality, room for improvement
- **error**: Functional issues, incorrect output, or missing required elements

**IMPORTANT**: Output ONLY the JSON result, no additional text or markdown formatting around it.
