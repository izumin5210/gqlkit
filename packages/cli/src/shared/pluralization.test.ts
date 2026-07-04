import { describe, expect, it } from "vitest";
import { pluralize, singularize } from "./pluralization.js";

describe("singularize", () => {
  it("singularizes regular plural words", () => {
    expect(singularize("parts")).toBe("part");
    expect(singularize("boxes")).toBe("box");
  });

  it("singularizes irregular plural words merged from both former dictionaries", () => {
    // Words that were already shared by naming-convention.ts and
    // enum-prefix-detector.ts before the merge.
    expect(singularize("children")).toBe("child");
    expect(singularize("people")).toBe("person");
    // Words that previously only existed in naming-convention.ts's
    // dictionary (enum-prefix-detector.ts relied on its generic suffix rule
    // to reach the same plural instead).
    expect(singularize("buses")).toBe("bus");
    expect(singularize("selfies")).toBe("selfie");
    expect(singularize("statuses")).toBe("status");
    expect(singularize("zombies")).toBe("zombie");
  });

  it("preserves ambiguous or non-inflecting words", () => {
    expect(singularize("axes")).toBe("axes");
    expect(singularize("news")).toBe("news");
  });
});

describe("pluralize", () => {
  it("pluralizes regular UPPER_SNAKE_CASE segments", () => {
    expect(pluralize("PART")).toBe("PARTS");
    expect(pluralize("BOX")).toBe("BOXES");
  });

  it("pluralizes irregular segments merged from both former dictionaries", () => {
    // Words that were already shared by naming-convention.ts and
    // enum-prefix-detector.ts before the merge.
    expect(pluralize("CHILD")).toBe("CHILDREN");
    expect(pluralize("PERSON")).toBe("PEOPLE");
    // Words that were only in naming-convention.ts's dictionary; the merged
    // dictionary now covers them explicitly, and this must keep matching
    // enum-prefix-detector.ts's previous generic-rule fallback.
    expect(pluralize("BUS")).toBe("BUSES");
    expect(pluralize("SELFIE")).toBe("SELFIES");
    expect(pluralize("STATUS")).toBe("STATUSES");
    expect(pluralize("ZOMBIE")).toBe("ZOMBIES");
  });
});
