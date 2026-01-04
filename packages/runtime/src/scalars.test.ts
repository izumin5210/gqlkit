/**
 * Tests for scalar type aliases
 *
 * These tests verify that the scalar type aliases are correctly defined
 * as simple type aliases (no longer branded types).
 * The CLI identifies these types by import path and name, not by branded type structure.
 */

import { describe, expect, it } from "vitest";
import type { Float, IDNumber, IDString, Int } from "./index.js";

describe("Scalar Type Aliases", () => {
  describe("IDString type", () => {
    it("should be a simple string type alias", () => {
      const id: IDString = "user-123";
      const str: string = id;
      expect(str).toBe("user-123");
    });

    it("should be assignable from plain string without cast", () => {
      const id: IDString = "user-123";
      expect(typeof id).toBe("string");
    });
  });

  describe("IDNumber type", () => {
    it("should be a simple number type alias", () => {
      const id: IDNumber = 123;
      const num: number = id;
      expect(num).toBe(123);
    });

    it("should be assignable from plain number without cast", () => {
      const id: IDNumber = 123;
      expect(typeof id).toBe("number");
    });
  });

  describe("Int type", () => {
    it("should be a simple number type alias", () => {
      const int: Int = 42;
      const num: number = int;
      expect(num).toBe(42);
    });

    it("should be assignable from plain number without cast", () => {
      const int: Int = 42;
      expect(typeof int).toBe("number");
    });
  });

  describe("Float type", () => {
    it("should be a simple number type alias", () => {
      const float: Float = 3.14;
      const num: number = float;
      expect(num).toBe(3.14);
    });

    it("should be assignable from plain number without cast", () => {
      const float: Float = 3.14;
      expect(typeof float).toBe("number");
    });
  });

  describe("Type distinction", () => {
    it("IDString and IDNumber should have different runtime types", () => {
      const idStr: IDString = "123";
      const idNum: IDNumber = 123;
      expect(typeof idStr).not.toBe(typeof idNum);
    });

    it("Int and Float should have the same runtime type (number)", () => {
      const int: Int = 42;
      const float: Float = 42.0;
      expect(typeof int).toBe(typeof float);
    });

    it("IDNumber, Int, and Float should all be number type at runtime", () => {
      const idNum: IDNumber = 1;
      const int: Int = 2;
      const float: Float = 3.0;
      expect(typeof idNum).toBe("number");
      expect(typeof int).toBe("number");
      expect(typeof float).toBe("number");
    });
  });

  describe("No runtime cost", () => {
    it("should have no runtime overhead for IDString", () => {
      const id: IDString = "test";
      expect(id).toBe("test");
    });

    it("should have no runtime overhead for IDNumber", () => {
      const id: IDNumber = 42;
      expect(id).toBe(42);
    });

    it("should have no runtime overhead for Int", () => {
      const int: Int = 100;
      expect(int).toBe(100);
    });

    it("should have no runtime overhead for Float", () => {
      const float: Float = 1.5;
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
});
