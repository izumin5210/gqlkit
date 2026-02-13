---
name: test-pruning-advisor
description: Use when asked to "review tests for deletion", "find redundant tests", "cleanup tests", "identify low-value tests", or wants to identify tests that should be considered for removal based on project testing guidelines.
---

# Test Pruning Advisor

Skill for identifying tests that should be considered for removal based on the project's testing guidelines.

## Purpose

Analyze test files to identify redundant, low-value, or obsolete tests that may be candidates for deletion. This skill follows the project's testing philosophy which prioritizes golden file tests over function-level unit tests.

## Deletion Consideration Criteria

Based on project testing guidelines (AGENTS.md / CLAUDE.md):

1. **Golden file test replaceable unit tests**: Function-level unit tests for code analysis, schema generation, or code generation logic that could be covered by testdata golden file tests
2. **Trivial tests**: Tests for simple getters/setters, direct value passthrough, or obvious behavior that provides minimal value
3. **Implementation-coupled tests**: Tests that are tightly coupled to internal implementation details and would break with reasonable refactoring
4. **Orphaned tests**: Tests for code or features that no longer exist in the codebase

## Workflow

### Step 1: Select Review Target

When the review target is not explicitly specified, ask the user (using the runtime's available interaction mechanism) to choose from the following options:

1. **Branch/PR changes**: Review only test files added/modified in current branch vs main
2. **All tests**: Review all `*.test.ts` files in the codebase
3. **Specific pattern**: Review tests matching a specific path or pattern

#### Getting Test Files by Target

```bash
# Branch/PR changes - test files added or modified
git diff main --name-only -- '**/*.test.ts' | grep -v testdata

# All test files (excluding testdata golden tests which are reviewed by golden-test-reviewer)
find packages -name "*.test.ts" -not -path "*/testdata/*" -not -path "*/__generated__/*"

# Specific pattern
find packages -name "*.test.ts" -path "*/<pattern>/*" -not -path "*/testdata/*"
```

### Step 2: Categorize Test Files

Group test files by their purpose:

| Category | Path Pattern | Notes |
|----------|--------------|-------|
| Type extraction | `packages/cli/src/type-extractor/*.test.ts` | May overlap with golden tests |
| Resolver extraction | `packages/cli/src/resolver-extractor/*.test.ts` | May overlap with golden tests |
| Schema generation | `packages/cli/src/schema-generator/*.test.ts` | May overlap with golden tests |
| Auto-type generation | `packages/cli/src/auto-type-generator/*.test.ts` | May overlap with golden tests |
| Shared utilities | `packages/cli/src/shared/*.test.ts` | Utility functions |
| Config loading | `packages/cli/src/config-loader/*.test.ts` | Configuration handling |
| Runtime | `packages/runtime/src/*.test.ts` | Runtime utilities |
| Golden tests | `packages/cli/src/gen-orchestrator/golden.test.ts` | Main golden test runner |

### Step 3: Launch Subagents for Analysis

For each test file (or cohesive batch of closely related files), create a separate subtask with an isolated context (subagent/subtask model) using the runtime's available execution mechanism (`1 review unit = 1 isolated subtask`).

**IMPORTANT**:
- Design each review unit as an independent subtask with explicit input/output.
- Execute independent subtasks in parallel when supported by the runtime.
- Pass only minimal required context to each subtask (target file(s), related source files, and evaluation criteria) to keep context isolated.
- Do not provide full repository-wide context to every subtask; keep context scoped to the review unit.
- Normalize and aggregate subtask outputs in the final report.

#### Subagent Prompt

Read the prompt template from **`references/subagent-prompt.md`** and use it for each subagent.

Replace placeholders:
- `{test-file-path}` - path to the test file
- `{category}` - category from the table above
- `{related-source-files}` - source files that the tests cover

### Step 4: Aggregate Results and Generate Report

After all subagents complete:

1. **Parse JSON results** from each subagent
2. **Generate summary table** showing all test files:

```markdown
## Review Summary

| Test File | Category | Tests | Deletable | Reason |
|-----------|----------|-------|-----------|--------|
| type-extractor/scanner.test.ts | Type extraction | 15 | 3 | Golden test overlap |
| shared/utils.test.ts | Utilities | 8 | 0 | - |
```

3. **List deletion candidates by reason**:

   Note: Cross-file synthesis (e.g., overlap and priority decisions across multiple categories) must be done during aggregation, not inside isolated subtasks.

```markdown
## Deletion Candidates

### Golden File Test Replaceable (High Confidence)
- **file.test.ts**: `describe("feature X")` - Covered by testdata/feature-x-basic/
  - Specific tests: `it("should handle...")`, `it("should convert...")`

### Trivial Tests (Medium Confidence)
- **file.test.ts**: `it("should return input")` - Tests obvious passthrough behavior

### Implementation-Coupled (Review Recommended)
- **file.test.ts**: `it("internal state...")` - Depends on internal implementation detail

### Orphaned Tests (High Confidence)
- **file.test.ts**: `describe("OldFeature")` - OldFeature no longer exists
```

4. **Provide confidence levels**:
   - **High**: Clear candidates for deletion
   - **Medium**: Likely candidates but verify before deleting
   - **Low**: Potentially removable but keep for now

5. **Summary statistics**:

```markdown
## Summary

- Total test files analyzed: X
- Total test cases: Y
- Deletion candidates: Z
  - High confidence: A
  - Medium confidence: B
  - Low confidence: C
- Estimated test reduction: Z/Y (XX%)
```

## Evaluation Confidence Levels

- **High Confidence**: Tests that clearly meet deletion criteria with no ambiguity
- **Medium Confidence**: Tests that likely meet criteria but should be verified
- **Low Confidence**: Tests that might be deletable but have some value

## Important Notes

- This skill does NOT evaluate golden file test cases in testdata/ - use `golden-test-reviewer` for that
- Focus on identifying tests that provide little value relative to maintenance cost
- Consider the project's "prefer golden file tests over unit tests" guideline
- Always provide reasoning for each deletion recommendation

## Additional Resources

### Reference Files

- **`references/subagent-prompt.md`** - Prompt template for subagent analysis
- **`references/evaluation-criteria.md`** - Detailed evaluation criteria with examples
