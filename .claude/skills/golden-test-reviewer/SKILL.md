---
name: golden-test-reviewer
description: This skill should be used when the user asks to "review golden test", "evaluate testcase", "check testdata quality", "review test coverage", or wants to validate golden test cases in packages/cli/src/gen-orchestrator/testdata/. Provides systematic evaluation workflow for gqlkit golden test cases.
---

# Golden Test Reviewer

Skill for reviewing and evaluating gqlkit golden test cases using parallel subagent evaluation.

## Purpose

Systematically evaluate golden test cases under `packages/cli/src/gen-orchestrator/testdata/`, identify issues, and provide concrete fix suggestions. Each test case is evaluated by a dedicated subagent in parallel for efficiency.

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

### Step 2: Launch Subagents for Parallel Evaluation

For each test case to be reviewed, launch a subagent using the Task tool with `subagent_type: "general-purpose"`.

**IMPORTANT**: Launch all subagents in a single response with multiple Task tool calls to enable parallel execution.

#### Subagent Prompt

Read the prompt template from **`references/subagent-prompt.md`** and use it for each subagent. Replace `{test-case-name}` with the actual test case name.

The prompt instructs subagents to:
1. Read all files in the test case directory
2. Evaluate against 6 criteria (naming, source quality, schema accuracy, resolvers, diagnostics, MECE)
3. Return structured JSON with ratings and issues

#### Example: Launching Multiple Subagents

When reviewing test cases `interface-basic`, `union-type`, and `field-resolver`:

```
// In a single response, make 3 Task tool calls in parallel:
Task(subagent_type="general-purpose", prompt="Review the golden test case 'interface-basic'...")
Task(subagent_type="general-purpose", prompt="Review the golden test case 'union-type'...")
Task(subagent_type="general-purpose", prompt="Review the golden test case 'field-resolver'...")
```

### Step 3: Aggregate Results and Generate Report

After all subagents complete:

1. **Parse JSON results** from each subagent
2. **Generate summary table** showing all test cases at a glance:

```markdown
## Review Summary

| Test Case | Naming | Source | Types | Conversion | Resolvers | Diagnostics | MECE | Issues |
|-----------|--------|--------|-------|------------|-----------|-------------|------|--------|
| interface-basic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 1 |
| union-type | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| field-resolver | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 0 |
```

3. **List issues by severity** (errors first, then warnings):

```markdown
## Issues Found

### Errors
- **test-case-name**: Description of error (Suggestion: ...)

### Warnings
- **test-case-name**: Description of warning (Suggestion: ...)
```

4. **Provide detailed reports** for test cases with issues (expand from JSON)

## Evaluation Ratings

- ✅ **Good** (`"good"`): No issues
- ⚠️ **Warning** (`"warning"`): Room for improvement (functionally correct)
- ❌ **Error** (`"error"`): Fix required

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

- **`references/subagent-prompt.md`** - Prompt template for subagent evaluation
- **`references/evaluation-criteria.md`** - Detailed criteria and judgment examples
- **`references/testcase-structure.md`** - Test case structure and conventions
