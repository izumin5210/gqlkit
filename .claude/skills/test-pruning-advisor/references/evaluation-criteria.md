# Evaluation Criteria Reference

Detailed criteria and examples for evaluating test deletion candidates.

## Criterion 1: Golden File Test Replaceable

### Definition

A unit test that could be replaced by a golden file test in `testdata/` because:
- It tests the same behavior that golden tests verify
- The test's assertions match what golden file comparison would catch
- Maintaining both provides no additional value

### Signals (Strong Indicators)

- Test is in `type-extractor/`, `resolver-extractor/`, `schema-generator/`, or `auto-type-generator/`
- Test creates TypeScript source, runs extraction/generation, and verifies output
- Test assertions check GraphQL schema structure or resolver map content
- A testdata/ case exists with similar input patterns

### Counter-Signals (Keep the Test)

- Test verifies error handling for invalid inputs (may not be in golden tests)
- Test covers edge cases not worth a full testdata case
- Test provides faster feedback than running full golden tests
- Test documents specific API contract

### Examples

**Deletable (High Confidence)**:
```typescript
// type-extractor/interface.test.ts
it("should extract interface type", () => {
  const source = `export interface User { name: string }`;
  const result = extractTypes(source);
  expect(result.types[0].kind).toBe("interface");
});
// Reason: testdata/interface-basic/ covers this exact scenario
```

**Keep**:
```typescript
// type-extractor/interface.test.ts
it("should throw on circular interface inheritance", () => {
  const source = `interface A extends B {} interface B extends A {}`;
  expect(() => extractTypes(source)).toThrow("Circular inheritance");
});
// Reason: Error case may not be in golden tests, documents expected behavior
```

## Criterion 2: Trivial Tests

### Definition

Tests that verify obvious behavior with no meaningful logic:
- Simple property access
- Direct value passthrough
- Constructor initialization without validation
- Identity transformations

### Signals (Strong Indicators)

- Test name describes exactly what code obviously does
- Single assertion on a property value
- No branching logic in tested code
- Test and implementation are nearly identical in complexity

### Counter-Signals (Keep the Test)

- Property has validation or transformation
- Getter/setter has side effects
- Test documents non-obvious default values
- Test catches regression from accidental deletion

### Examples

**Deletable (Medium Confidence)**:
```typescript
it("should return name", () => {
  const user = new User("Alice");
  expect(user.name).toBe("Alice");
});
// Reason: Tests obvious constructor assignment
```

**Keep**:
```typescript
it("should normalize name to lowercase", () => {
  const user = new User("ALICE");
  expect(user.name).toBe("alice");
});
// Reason: Tests transformation logic, not obvious
```

## Criterion 3: Implementation-Coupled Tests

### Definition

Tests that depend on internal implementation details rather than public behavior:
- Tests internal state not visible through public API
- Mocks internal modules instead of external dependencies
- Asserts on intermediate steps rather than final output
- Would break if implementation changed but behavior stayed same

### Signals (Strong Indicators)

- Test accesses private/internal properties
- Test mocks internal helper functions
- Test verifies internal data structures
- Refactoring the code (keeping behavior) would break the test

### Counter-Signals (Keep the Test)

- Internal state is actually part of the contract (e.g., caching behavior)
- Test documents important internal invariants
- Mocking is necessary for isolation from slow external dependencies

### Examples

**Deletable (Medium Confidence)**:
```typescript
it("should cache parsed types", () => {
  const extractor = new TypeExtractor();
  extractor.extract(source);
  // @ts-ignore accessing private
  expect(extractor._cache.size).toBe(5);
});
// Reason: Tests internal cache, not public behavior
```

**Keep**:
```typescript
it("should not re-parse same file", () => {
  const extractor = new TypeExtractor();
  const spy = vi.spyOn(ts, "createSourceFile");
  extractor.extract(source);
  extractor.extract(source); // Same source
  expect(spy).toHaveBeenCalledTimes(1);
});
// Reason: Caching is performance-critical behavior worth testing
```

## Criterion 4: Orphaned Tests

### Definition

Tests for code that no longer exists:
- Tested function/class was deleted
- Tested feature was removed
- Module was renamed and test wasn't updated

### Signals (Strong Indicators)

- Import statements reference non-existent files
- Test describes functionality not in current codebase
- Test file name doesn't match any source file

### Counter-Signals (Keep the Test)

- Feature is temporarily disabled (check git history)
- Test is for planned feature (check issues/PRs)

### Examples

**Deletable (High Confidence)**:
```typescript
// legacy-parser.test.ts
import { legacyParser } from "../legacy-parser"; // File doesn't exist
```

## Decision Matrix

| Criterion | High Confidence | Medium Confidence | Low Confidence |
|-----------|-----------------|-------------------|----------------|
| Golden replaceable | Exact testdata match exists | Similar testdata exists | Partial coverage |
| Trivial | Obvious passthrough, no logic | Simple but documents defaults | Has some validation |
| Implementation-coupled | Tests private state only | Tests internals but useful | Some coupling, some value |
| Orphaned | Code deleted, import fails | Code renamed, test outdated | Feature disabled |

## Recommendation Guidelines

### Recommend "delete"

- High confidence deletion candidate
- No counter-signals present
- Clear reasoning documented

### Recommend "review"

- Medium confidence deletion candidate
- Some counter-signals but deletion likely beneficial
- Human judgment needed

### Recommend "keep_for_now"

- Low confidence or unclear
- Counter-signals present
- Provides some value even if suboptimal
