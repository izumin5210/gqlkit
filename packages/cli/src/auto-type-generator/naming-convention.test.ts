import { describe, expect, it } from "vitest";
import {
  appendFieldPath,
  generateAutoTypeName,
  singularizeFieldName,
} from "./naming-convention.js";

describe("singularizeFieldName", () => {
  it("singularizes simple plural field names", () => {
    expect(singularizeFieldName("parts")).toBe("part");
    expect(singularizeFieldName("toolCalls")).toBe("toolCall");
  });

  it("handles common plural suffixes conservatively", () => {
    expect(singularizeFieldName("categories")).toBe("category");
    expect(singularizeFieldName("boxes")).toBe("box");
    expect(singularizeFieldName("statuses")).toBe("status");
  });

  it("preserves ambiguous or non-inflecting names", () => {
    expect(singularizeFieldName("news")).toBe("news");
    expect(singularizeFieldName("series")).toBe("series");
    expect(singularizeFieldName("status")).toBe("status");
  });
});

describe("appendFieldPath", () => {
  it("singularizes only array-backed path segments", () => {
    expect(
      appendFieldPath({
        parentPath: ["message"],
        fieldName: "parts",
        singularize: true,
      }),
    ).toEqual(["message", "part"]);
    expect(
      appendFieldPath({
        parentPath: ["message"],
        fieldName: "metadata",
        singularize: false,
      }),
    ).toEqual(["message", "metadata"]);
  });
});

describe("generateAutoTypeName", () => {
  it("uses singularized names for object field array elements", () => {
    expect(
      generateAutoTypeName({
        kind: "objectField",
        parentTypeName: "Message",
        fieldPath: ["part"],
      }),
    ).toBe("MessagePart");
  });

  it("uses singularized names for input field array elements", () => {
    expect(
      generateAutoTypeName({
        kind: "inputField",
        parentTypeName: "MessageInput",
        fieldPath: ["part"],
      }),
    ).toBe("MessagePartInput");
  });

  it("uses singularized names for resolver argument array elements", () => {
    expect(
      generateAutoTypeName({
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "search",
        argName: "filters",
        parentTypeName: null,
        fieldPath: ["part"],
      }),
    ).toBe("SearchFiltersPartInput");
  });

  it("uses singularized names for resolver payload array elements", () => {
    expect(
      generateAutoTypeName({
        kind: "resolverPayload",
        resolverType: "query",
        fieldName: "search",
        parentTypeName: null,
        fieldPath: ["part"],
      }),
    ).toBe("SearchPayloadPart");
  });
});
