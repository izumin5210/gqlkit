---
name: golden-test-reviewer
description: This skill should be used when the user asks to "review golden test", "evaluate testcase", "check testdata quality", "review test coverage", "review PR", "review branch", "code review", or wants to validate golden test cases in packages/cli/src/gen-orchestrator/testdata/. When triggered by general code review requests (PR/branch review), this skill handles the golden test portion of the review. Provides systematic evaluation workflow for gqlkit golden test cases.
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
4. **PR/Branch Review**: Review golden tests affected by a specific PR or branch
   - Reviews test cases modified in the PR/branch
   - Evaluates test coverage for features changed in the PR/branch

#### Detecting Review Mode

When triggered by code review requests (e.g., "review PR #123", "review this branch"), automatically use **PR/Branch Review** mode.

- If PR number is provided: Use `gh pr diff <number>` to get the diff
- If branch name is provided or current branch differs from main: Use `git diff main...<branch>`

#### Getting Changed Test Cases

```bash
# Get test cases with changes (for Diff mode)
git diff main --name-only -- packages/cli/src/gen-orchestrator/testdata/ | \
  sed 's|packages/cli/src/gen-orchestrator/testdata/||' | \
  cut -d'/' -f1 | sort -u

# Get test cases with changes from PR (for PR/Branch Review mode)
gh pr diff <PR_NUMBER> --name-only | \
  grep '^packages/cli/src/gen-orchestrator/testdata/' | \
  sed 's|packages/cli/src/gen-orchestrator/testdata/||' | \
  cut -d'/' -f1 | sort -u

# Get test cases with changes from branch (for PR/Branch Review mode)
git diff main...<branch> --name-only -- packages/cli/src/gen-orchestrator/testdata/ | \
  sed 's|packages/cli/src/gen-orchestrator/testdata/||' | \
  cut -d'/' -f1 | sort -u
```

### Step 1.5: PR/Branch Review - Analyze Diff and Identify Affected Features (PR/Branch Review mode only)

When in PR/Branch Review mode, perform additional analysis to identify affected features and evaluate test coverage.

#### 1.5.1: Get Full Diff

```bash
# For PR
gh pr diff <PR_NUMBER>

# For branch
git diff main...<branch>
```

#### 1.5.2: Identify Affected CLI Components

Analyze the diff to identify which CLI components are affected. Map changed files to feature categories:

| Changed Path | Feature Category |
|--------------|------------------|
| `packages/cli/src/type-extractor/` | Type extraction (interfaces, unions, scalars, etc.) |
| `packages/cli/src/resolver-extractor/` | Resolver extraction |
| `packages/cli/src/schema-generator/` | Schema generation |
| `packages/cli/src/shared/` | Shared utilities (TSDoc, directives, etc.) |
| `packages/runtime/` | Runtime utilities (branded scalars, defineField, etc.) |

#### 1.5.3: Map Features to Test Categories

Based on affected components, determine which test categories should have coverage:

| Component Change | Expected Test Categories |
|------------------|--------------------------|
| Interface handling | `interface-*` |
| Union handling | `union-*` |
| Scalar handling | `scalar-*`, `branded-scalar` |
| Directive handling | `directive-*`, `deprecated-*` |
| Input type handling | `input-*`, `oneof-*` |
| Default value handling | `default-value-*` |
| Error handling | `*-errors`, `type-error-*` |
| TSDoc parsing | `tsdoc-*` |

#### 1.5.4: Check Test Coverage

Compare the expected test categories with actually modified/added test cases. Flag gaps where:
- A feature is modified but no corresponding test case is added/modified
- A new feature is added but no test case covers it

This analysis will be included in the final report (Step 3).

### Step 2: Launch Subagents for Parallel Evaluation

For each test case to be reviewed, launch a subagent using the Task tool with `subagent_type: "general-purpose"`.

**IMPORTANT**: Launch all subagents in a single response with multiple Task tool calls to enable parallel execution.

#### Subagent Prompt

Read the prompt template from **`references/subagent-prompt.md`** and use it for each subagent.

**For standard review (All, Category, Diff modes)**:
- Use the first template in `references/subagent-prompt.md`
- Replace `{test-case-name}` with the actual test case name
- Evaluates against 6 criteria (naming, source quality, schema accuracy, resolvers, diagnostics, MECE)

**For PR/Branch Review mode**:
- Use the second template (PR/Branch Review Mode) in `references/subagent-prompt.md`
- Replace placeholders:
  - `{test-case-name}` - actual test case name
  - `{pr-number}` or `{branch-name}` - PR number or branch name
  - `{diff-summary}` - summary of changed files in the PR/branch
  - `{test-case-diff}` - diff content for the specific test case
- Evaluates against 7 criteria (standard 6 + change appropriateness)

#### Example: Launching Multiple Subagents (Standard Mode)

When reviewing test cases `interface-basic`, `union-type`, and `field-resolver`:

```
// In a single response, make 3 Task tool calls in parallel:
Task(subagent_type="general-purpose", prompt="Review the golden test case 'interface-basic'...")
Task(subagent_type="general-purpose", prompt="Review the golden test case 'union-type'...")
Task(subagent_type="general-purpose", prompt="Review the golden test case 'field-resolver'...")
```

#### Example: Launching Subagents (PR/Branch Review Mode)

When reviewing test cases modified in PR #123:

```
// In a single response, make Task tool calls for each modified test case:
Task(subagent_type="general-purpose", prompt="Review the golden test case 'interface-basic' modified in PR #123. Context: Changes in this PR... [diff-summary]. Test case diff: [test-case-diff]...")
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

5. **(PR/Branch Review mode only) Include Test Coverage Analysis**:

```markdown
## Test Coverage Analysis

### Affected Components
| Component | Changed Files |
|-----------|---------------|
| type-extractor | `interface.ts`, `union.ts` |
| schema-generator | `builder.ts` |

### Expected vs Actual Test Coverage
| Feature Category | Expected | Actual | Status |
|------------------|----------|--------|--------|
| Interface handling | `interface-*` | `interface-basic` (modified) | ✅ Covered |
| Union handling | `union-*` | (none) | ⚠️ Missing |

### Coverage Gaps
- **Union handling**: Changes to `type-extractor/union.ts` but no union test cases modified or added
  - Suggestion: Consider adding/updating `union-*` test cases to cover the changes

### Coverage Summary
- Components changed: 2
- Test categories expected: 2
- Test categories covered: 1
- Coverage gaps: 1
```

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
