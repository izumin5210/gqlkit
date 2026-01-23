# Subagent Prompt Template

Prompt template for analyzing test files for deletion candidates. Replace placeholders as indicated.

---

Analyze the test file "{test-file-path}" for deletion candidates.

## Context

- **Category**: {category}
- **Related source files**: {related-source-files}

## Your Task

1. Read the test file and understand what it tests
2. Read the related source file(s) to understand the tested functionality
3. Check if similar scenarios are covered by golden file tests in `packages/cli/src/gen-orchestrator/testdata/`
4. Evaluate each test case against the deletion criteria
5. Return a structured analysis result

## Project Testing Guidelines

This project follows these testing principles:

1. **Prefer golden file tests over unit tests**: For code analysis, schema generation, and code generation logic, avoid function-level unit tests. Instead, add test cases to testdata/ to verify correct behavior.
2. **Keep testdata MECE**: Each case should cover a distinct scenario without overlap.
3. **Test behavior, not implementation**: Tests should verify what code does, not how it does it.

## Deletion Criteria

### 1. Golden File Test Replaceable

A test is replaceable by golden file tests if:
- It tests type extraction, schema generation, resolver mapping, or code generation
- The same scenario can be expressed as a testdata/ case
- The test verifies output format rather than internal behavior

**Example**: A unit test that checks "interface types are converted to GraphQL interface" could be replaced by a testdata/interface-basic/ golden test case.

### 2. Trivial Tests

A test is trivial if:
- It tests obvious getter/setter behavior with no logic
- It tests simple value passthrough with no transformation
- It verifies constructor sets properties correctly (without validation logic)
- The test name describes exactly what the code obviously does

**Example**: `it("should return the name property")` for a simple getter.

### 3. Implementation-Coupled Tests

A test is implementation-coupled if:
- It tests internal state that isn't part of public API
- It would break if internal implementation changed (even if behavior stayed same)
- It mocks internal modules rather than external dependencies
- It asserts on intermediate values rather than final output

**Example**: Testing that an internal cache is populated after a call.

### 4. Orphaned Tests

A test is orphaned if:
- The tested function/class no longer exists
- The tested feature was removed
- The imports reference non-existent modules

## Output Format

Return your analysis in this exact JSON format:

```json
{
  "testFile": "{test-file-path}",
  "category": "{category}",
  "overview": {
    "totalTestCases": 10,
    "totalDescribeBlocks": 3,
    "testedFunctionality": "Brief description of what this file tests"
  },
  "deletionCandidates": [
    {
      "testName": "describe/it block name",
      "lineRange": "10-25",
      "reason": "golden_replaceable|trivial|implementation_coupled|orphaned",
      "confidence": "high|medium|low",
      "explanation": "Why this test should be considered for deletion",
      "goldenTestEquivalent": "testdata/case-name/ (only for golden_replaceable, omit otherwise)",
      "recommendation": "delete|review|keep_for_now"
    }
  ],
  "keepRecommendations": [
    {
      "testName": "describe/it block name",
      "reason": "Why this test provides value and should be kept"
    }
  ],
  "summary": {
    "totalDeletable": 3,
    "byReason": {
      "golden_replaceable": 2,
      "trivial": 1,
      "implementation_coupled": 0,
      "orphaned": 0
    },
    "byConfidence": {
      "high": 2,
      "medium": 1,
      "low": 0
    }
  }
}
```

## Confidence Guidelines

- **High**: Clear-cut case, deletion is safe
  - Golden file test exists that covers the exact same scenario
  - Test is clearly orphaned (tested code doesn't exist)
  - Test is obviously trivial with no edge case coverage

- **Medium**: Likely deletable but verify
  - Similar golden file test exists but not exact match
  - Test seems trivial but might catch edge cases
  - Implementation coupling is present but test has some value

- **Low**: Potentially deletable but risky
  - Golden file test coverage is partial
  - Test has some implementation coupling but also tests important behavior
  - Not clearly trivial but low value

## Important Notes

- Focus on tests that provide low value relative to maintenance cost
- Consider the project's "prefer golden file tests over unit tests" guideline
- Be conservative: when in doubt, recommend "keep_for_now"
- Always provide clear reasoning for each recommendation

**IMPORTANT**: Output ONLY the JSON result, no additional text or markdown formatting around it.
