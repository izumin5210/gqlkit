/**
 * Tests for Scalar Metadata System
 *
 * These tests verify:
 * - ScalarMetadataShape interface (Task 1.3)
 * - DefineScalar utility type (Task 1.2)
 * - Built-in scalar types with metadata (Task 1.1)
 * - Requirements: 2.1-2.5, 3.1-3.4, 4.1-4.4
 */

import { describe, expect, it } from "vitest";
import type {
  DefineScalar,
  Float,
  IDNumber,
  IDString,
  Int,
  ScalarMetadataKey,
  ScalarMetadataShape,
} from "./index.js";

describe("Scalar Metadata System", () => {
  describe("ScalarMetadataShape interface (Task 1.3)", () => {
    it("should define name property as string", () => {
      const shape: ScalarMetadataShape = {
        name: "DateTime",
      };
      expect(shape.name).toBe("DateTime");
    });

    it("should allow only property with 'input' value", () => {
      const shape: ScalarMetadataShape = {
        name: "DateTime",
        only: "input",
      };
      expect(shape.only).toBe("input");
    });

    it("should allow only property with 'output' value", () => {
      const shape: ScalarMetadataShape = {
        name: "DateTime",
        only: "output",
      };
      expect(shape.only).toBe("output");
    });

    it("should allow only property to be omitted", () => {
      const shape: ScalarMetadataShape = {
        name: "DateTime",
      };
      expect(shape.only).toBeUndefined();
    });
  });

  describe("ScalarMetadataKey constant (Task 1.3)", () => {
    it("should be the expected string with spaces", () => {
      const key: ScalarMetadataKey = " $gqlkitScalar";
      expect(key).toBe(" $gqlkitScalar");
    });
  });

  describe("DefineScalar utility type (Task 1.2)", () => {
    describe("basic usage", () => {
      it("should create a type assignable from the base type", () => {
        type DateTime = DefineScalar<"DateTime", Date>;
        const date: DateTime = new Date("2024-01-01");
        expect(date instanceof Date).toBe(true);
      });

      it("should create a type assignable to the base type", () => {
        type DateTime = DefineScalar<"DateTime", Date>;
        const date: DateTime = new Date("2024-01-01");
        const asDate: Date = date;
        expect(asDate instanceof Date).toBe(true);
      });

      it("should work with string base type", () => {
        type DateTimeString = DefineScalar<"DateTime", string>;
        const dt: DateTimeString = "2024-01-01T00:00:00Z";
        const str: string = dt;
        expect(str).toBe("2024-01-01T00:00:00Z");
      });

      it("should work with number base type", () => {
        type Timestamp = DefineScalar<"Timestamp", number>;
        const ts: Timestamp = 1704067200;
        const num: number = ts;
        expect(num).toBe(1704067200);
      });
    });

    describe("only parameter", () => {
      it("should default to undefined (input/output both)", () => {
        type DateTime = DefineScalar<"DateTime", Date>;
        const date: DateTime = new Date();
        expect(date instanceof Date).toBe(true);
      });

      it("should accept 'input' as only parameter", () => {
        type DateTimeInput = DefineScalar<"DateTime", Date, "input">;
        const date: DateTimeInput = new Date();
        expect(date instanceof Date).toBe(true);
      });

      it("should accept 'output' as only parameter", () => {
        type DateTimeOutput = DefineScalar<"DateTime", Date, "output">;
        const date: DateTimeOutput = new Date();
        expect(date instanceof Date).toBe(true);
      });
    });

    describe("type-level metadata (compile-time checks)", () => {
      it("should preserve the scalar name at type level", () => {
        type DateTime = DefineScalar<"DateTime", Date>;
        type Metadata = NonNullable<DateTime[" $gqlkitScalar"]>;
        type Name = Metadata["name"];

        const name: Name = "DateTime";
        expect(name).toBe("DateTime");
      });

      it("should preserve only constraint at type level", () => {
        type DateTimeInput = DefineScalar<"DateTime", Date, "input">;
        type Metadata = NonNullable<DateTimeInput[" $gqlkitScalar"]>;
        type Only = Metadata["only"];

        const only: Only = "input";
        expect(only).toBe("input");
      });
    });
  });

  describe("Built-in scalar types with metadata (Task 1.1)", () => {
    describe("Int type", () => {
      it("should be assignable from number", () => {
        const int: Int = 42;
        expect(int).toBe(42);
      });

      it("should be assignable to number", () => {
        const int: Int = 42;
        const num: number = int;
        expect(num).toBe(42);
      });

      it("should have Int as scalar name in metadata", () => {
        type IntMetadata = NonNullable<Int[" $gqlkitScalar"]>;
        type IntName = IntMetadata["name"];
        const name: IntName = "Int";
        expect(name).toBe("Int");
      });
    });

    describe("Float type", () => {
      it("should be assignable from number", () => {
        const float: Float = 3.14;
        expect(float).toBe(3.14);
      });

      it("should be assignable to number", () => {
        const float: Float = 3.14;
        const num: number = float;
        expect(num).toBe(3.14);
      });

      it("should have Float as scalar name in metadata", () => {
        type FloatMetadata = NonNullable<Float[" $gqlkitScalar"]>;
        type FloatName = FloatMetadata["name"];
        const name: FloatName = "Float";
        expect(name).toBe("Float");
      });
    });

    describe("IDString type", () => {
      it("should be assignable from string", () => {
        const id: IDString = "user-123";
        expect(id).toBe("user-123");
      });

      it("should be assignable to string", () => {
        const id: IDString = "user-123";
        const str: string = id;
        expect(str).toBe("user-123");
      });

      it("should have ID as scalar name in metadata", () => {
        type IDStringMetadata = NonNullable<IDString[" $gqlkitScalar"]>;
        type IDName = IDStringMetadata["name"];
        const name: IDName = "ID";
        expect(name).toBe("ID");
      });
    });

    describe("IDNumber type", () => {
      it("should be assignable from number", () => {
        const id: IDNumber = 123;
        expect(id).toBe(123);
      });

      it("should be assignable to number", () => {
        const id: IDNumber = 123;
        const num: number = id;
        expect(num).toBe(123);
      });

      it("should have ID as scalar name in metadata", () => {
        type IDNumberMetadata = NonNullable<IDNumber[" $gqlkitScalar"]>;
        type IDName = IDNumberMetadata["name"];
        const name: IDName = "ID";
        expect(name).toBe("ID");
      });
    });
  });

  describe("Backward compatibility", () => {
    describe("IDString", () => {
      it("should work as a field type", () => {
        type User = { id: IDString };
        const user: User = { id: "user-1" };
        expect(user.id).toBe("user-1");
      });

      it("should work in arrays", () => {
        const ids: IDString[] = ["id-1", "id-2"];
        expect(ids.length).toBe(2);
      });

      it("should work with nullable types", () => {
        type MaybeId = IDString | null;
        const id: MaybeId = null;
        expect(id).toBeNull();
      });
    });

    describe("IDNumber", () => {
      it("should work as a field type", () => {
        type User = { id: IDNumber };
        const user: User = { id: 1 };
        expect(user.id).toBe(1);
      });
    });

    describe("Int", () => {
      it("should work as a field type", () => {
        type User = { age: Int };
        const user: User = { age: 25 };
        expect(user.age).toBe(25);
      });
    });

    describe("Float", () => {
      it("should work as a field type", () => {
        type User = { rating: Float };
        const user: User = { rating: 4.5 };
        expect(user.rating).toBe(4.5);
      });
    });

    describe("Combined usage", () => {
      it("should work together in a type definition", () => {
        type User = {
          id: IDString;
          numericId: IDNumber;
          age: Int;
          rating: Float;
        };

        const user: User = {
          id: "user-1",
          numericId: 1,
          age: 25,
          rating: 4.5,
        };

        expect(user.id).toBe("user-1");
        expect(user.numericId).toBe(1);
        expect(user.age).toBe(25);
        expect(user.rating).toBe(4.5);
      });
    });
  });

  describe("No runtime cost", () => {
    it("should have no runtime overhead for Int", () => {
      const int: Int = 100;
      expect(int).toBe(100);
      expect(typeof int).toBe("number");
    });

    it("should have no runtime overhead for Float", () => {
      const float: Float = 1.5;
      expect(float).toBe(1.5);
      expect(typeof float).toBe("number");
    });

    it("should have no runtime overhead for IDString", () => {
      const id: IDString = "test";
      expect(id).toBe("test");
      expect(typeof id).toBe("string");
    });

    it("should have no runtime overhead for IDNumber", () => {
      const id: IDNumber = 42;
      expect(id).toBe(42);
      expect(typeof id).toBe("number");
    });

    it("should have no runtime overhead for DefineScalar", () => {
      type DateTime = DefineScalar<"DateTime", Date>;
      const date: DateTime = new Date("2024-01-01");
      expect(date instanceof Date).toBe(true);
    });
  });
});
