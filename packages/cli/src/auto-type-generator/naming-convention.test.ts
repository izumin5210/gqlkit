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
    expect(singularizeFieldName("aliases")).toBe("alias");
    expect(singularizeFieldName("boxes")).toBe("box");
    expect(singularizeFieldName("cookies")).toBe("cookie");
    expect(singularizeFieldName("movies")).toBe("movie");
    expect(singularizeFieldName("statuses")).toBe("status");
  });

  it("handles irregular plural field names through the local dictionary", () => {
    expect(singularizeFieldName("people")).toBe("person");
    expect(singularizeFieldName("children")).toBe("child");
    expect(singularizeFieldName("women")).toBe("woman");
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
        siblingFieldNames: null,
      }),
    ).toEqual(["message", "part"]);
    expect(
      appendFieldPath({
        parentPath: ["message"],
        fieldName: "metadata",
        singularize: false,
        siblingFieldNames: null,
      }),
    ).toEqual(["message", "metadata"]);
  });

  it("preserves plural array segment when singularized name collides with a sibling", () => {
    expect(
      appendFieldPath({
        parentPath: ["message"],
        fieldName: "parts",
        singularize: true,
        siblingFieldNames: new Set(["part", "parts"]),
      }),
    ).toEqual(["message", "parts"]);
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
