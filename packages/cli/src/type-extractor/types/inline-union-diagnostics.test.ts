import { describe, expect, it } from "vitest";
import type { Diagnostic, DiagnosticCode } from "./diagnostics.js";

describe("Inline Union Diagnostic Codes", () => {
  it("should include INLINE_UNION_PRIMITIVE_MEMBER diagnostic code", () => {
    const code: DiagnosticCode = "INLINE_UNION_PRIMITIVE_MEMBER";
    expect(code).toBe("INLINE_UNION_PRIMITIVE_MEMBER");
  });

  it("should include INLINE_UNION_ENUM_MEMBER diagnostic code", () => {
    const code: DiagnosticCode = "INLINE_UNION_ENUM_MEMBER";
    expect(code).toBe("INLINE_UNION_ENUM_MEMBER");
  });

  it("should include INLINE_UNION_UNRESOLVABLE_MEMBER diagnostic code", () => {
    const code: DiagnosticCode = "INLINE_UNION_UNRESOLVABLE_MEMBER";
    expect(code).toBe("INLINE_UNION_UNRESOLVABLE_MEMBER");
  });

  it("should be usable in Diagnostic objects with location info", () => {
    const diagnostic: Diagnostic = {
      code: "INLINE_UNION_PRIMITIVE_MEMBER",
      message:
        "Union member 'string' is a primitive type. GraphQL unions can only contain object types.",
      severity: "error",
      location: {
        file: "schema.ts",
        line: 15,
        column: 3,
      },
    };

    expect(diagnostic.code).toBe("INLINE_UNION_PRIMITIVE_MEMBER");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.location).not.toBeNull();
    expect(diagnostic.location?.file).toBe("schema.ts");
    expect(diagnostic.location?.line).toBe(15);
    expect(diagnostic.location?.column).toBe(3);
  });

  it("should support error message for enum member in union", () => {
    const diagnostic: Diagnostic = {
      code: "INLINE_UNION_ENUM_MEMBER",
      message:
        "Union member 'Status' is an enum type. GraphQL unions can only contain object types.",
      severity: "error",
      location: {
        file: "types.ts",
        line: 25,
        column: 5,
      },
    };

    expect(diagnostic.code).toBe("INLINE_UNION_ENUM_MEMBER");
    expect(diagnostic.message).toContain("enum type");
  });

  it("should support error message for unresolvable member in union", () => {
    const diagnostic: Diagnostic = {
      code: "INLINE_UNION_UNRESOLVABLE_MEMBER",
      message:
        "Union member could not be resolved as an object type. Ensure all members are valid object types.",
      severity: "error",
      location: {
        file: "models.ts",
        line: 42,
        column: 10,
      },
    };

    expect(diagnostic.code).toBe("INLINE_UNION_UNRESOLVABLE_MEMBER");
    expect(diagnostic.message).toContain("could not be resolved");
  });
});
