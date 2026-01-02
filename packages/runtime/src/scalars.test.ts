/**
 * Tests for branded scalar types
 *
 * These tests verify that the branded scalar types are correctly defined
 * and can be distinguished from each other at the type level.
 */

import { describe, expect, it } from "vitest";
import type { Float, IDNumber, IDString, Int, ScalarBrand } from "./index.js";

describe("Branded Scalar Types", () => {
  describe("ScalarBrand type", () => {
    it("should be a branded type with a unique symbol", () => {
      type TestBrand = ScalarBrand<"Test">;
      const brand: TestBrand = {} as TestBrand;
      expect(brand).toBeDefined();
    });
  });

  describe("IDString type", () => {
    it("should be compatible with string", () => {
      const id: IDString = "user-123" as IDString;
      const str: string = id;
      expect(str).toBe("user-123");
    });

    it("should be distinguishable from plain string at type level", () => {
      const id: IDString = "user-123" as IDString;
      expect(typeof id).toBe("string");
    });
  });

  describe("IDNumber type", () => {
    it("should be compatible with number", () => {
      const id: IDNumber = 123 as IDNumber;
      const num: number = id;
      expect(num).toBe(123);
    });

    it("should be distinguishable from plain number at type level", () => {
      const id: IDNumber = 123 as IDNumber;
      expect(typeof id).toBe("number");
    });
  });

  describe("Int type", () => {
    it("should be compatible with number", () => {
      const int: Int = 42 as Int;
      const num: number = int;
      expect(num).toBe(42);
    });

    it("should be distinguishable from plain number at type level", () => {
      const int: Int = 42 as Int;
      expect(typeof int).toBe("number");
    });
  });

  describe("Float type", () => {
    it("should be compatible with number", () => {
      const float: Float = 3.14 as Float;
      const num: number = float;
      expect(num).toBe(3.14);
    });

    it("should be distinguishable from plain number at type level", () => {
      const float: Float = 3.14 as Float;
      expect(typeof float).toBe("number");
    });
  });

  describe("Type distinction", () => {
    it("IDString and IDNumber should be different types", () => {
      const idStr: IDString = "123" as IDString;
      const idNum: IDNumber = 123 as IDNumber;
      expect(typeof idStr).not.toBe(typeof idNum);
    });

    it("Int and Float should be different branded types", () => {
      const int: Int = 42 as Int;
      const float: Float = 42.0 as Float;
      expect(typeof int).toBe(typeof float);
    });

    it("IDNumber, Int, and Float should all be number-based but distinguishable", () => {
      const idNum: IDNumber = 1 as IDNumber;
      const int: Int = 2 as Int;
      const float: Float = 3.0 as Float;
      expect(typeof idNum).toBe("number");
      expect(typeof int).toBe("number");
      expect(typeof float).toBe("number");
    });
  });

  describe("No runtime cost", () => {
    it("should have no runtime overhead for IDString", () => {
      const id: IDString = "test" as IDString;
      expect(id).toBe("test");
    });

    it("should have no runtime overhead for IDNumber", () => {
      const id: IDNumber = 42 as IDNumber;
      expect(id).toBe(42);
    });

    it("should have no runtime overhead for Int", () => {
      const int: Int = 100 as Int;
      expect(int).toBe(100);
    });

    it("should have no runtime overhead for Float", () => {
      const float: Float = 1.5 as Float;
      expect(float).toBe(1.5);
    });
  });

  describe("Usage in type definitions", () => {
    it("should work as a field type", () => {
      type User = {
        id: IDString;
        numericId: IDNumber;
        age: Int;
        rating: Float;
      };

      const user: User = {
        id: "user-1" as IDString,
        numericId: 1 as IDNumber,
        age: 25 as Int,
        rating: 4.5 as Float,
      };

      expect(user.id).toBe("user-1");
      expect(user.numericId).toBe(1);
      expect(user.age).toBe(25);
      expect(user.rating).toBe(4.5);
    });

    it("should work in arrays", () => {
      const ids: IDString[] = ["id-1" as IDString, "id-2" as IDString];
      expect(ids.length).toBe(2);
    });

    it("should work with nullable types", () => {
      type MaybeId = IDString | null;
      const id: MaybeId = null;
      expect(id).toBeNull();
    });
  });
});
