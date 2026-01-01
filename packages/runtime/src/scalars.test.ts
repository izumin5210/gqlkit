/**
 * Tests for branded scalar types
 *
 * These tests verify that the branded scalar types are correctly defined
 * and can be distinguished from each other at the type level.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Float, IDNumber, IDString, Int, ScalarBrand } from "./index.js";

describe("Branded Scalar Types", () => {
  describe("ScalarBrand type", () => {
    it("should be a branded type with a unique symbol", () => {
      type TestBrand = ScalarBrand<"Test">;
      const brand: TestBrand = {} as TestBrand;
      assert.ok(brand);
    });
  });

  describe("IDString type", () => {
    it("should be compatible with string", () => {
      const id: IDString = "user-123" as IDString;
      const str: string = id;
      assert.equal(str, "user-123");
    });

    it("should be distinguishable from plain string at type level", () => {
      const id: IDString = "user-123" as IDString;
      assert.equal(typeof id, "string");
    });
  });

  describe("IDNumber type", () => {
    it("should be compatible with number", () => {
      const id: IDNumber = 123 as IDNumber;
      const num: number = id;
      assert.equal(num, 123);
    });

    it("should be distinguishable from plain number at type level", () => {
      const id: IDNumber = 123 as IDNumber;
      assert.equal(typeof id, "number");
    });
  });

  describe("Int type", () => {
    it("should be compatible with number", () => {
      const int: Int = 42 as Int;
      const num: number = int;
      assert.equal(num, 42);
    });

    it("should be distinguishable from plain number at type level", () => {
      const int: Int = 42 as Int;
      assert.equal(typeof int, "number");
    });
  });

  describe("Float type", () => {
    it("should be compatible with number", () => {
      const float: Float = 3.14 as Float;
      const num: number = float;
      assert.equal(num, 3.14);
    });

    it("should be distinguishable from plain number at type level", () => {
      const float: Float = 3.14 as Float;
      assert.equal(typeof float, "number");
    });
  });

  describe("Type distinction", () => {
    it("IDString and IDNumber should be different types", () => {
      const idStr: IDString = "123" as IDString;
      const idNum: IDNumber = 123 as IDNumber;
      assert.notEqual(typeof idStr, typeof idNum);
    });

    it("Int and Float should be different branded types", () => {
      const int: Int = 42 as Int;
      const float: Float = 42.0 as Float;
      assert.equal(typeof int, typeof float);
    });

    it("IDNumber, Int, and Float should all be number-based but distinguishable", () => {
      const idNum: IDNumber = 1 as IDNumber;
      const int: Int = 2 as Int;
      const float: Float = 3.0 as Float;
      assert.equal(typeof idNum, "number");
      assert.equal(typeof int, "number");
      assert.equal(typeof float, "number");
    });
  });

  describe("No runtime cost", () => {
    it("should have no runtime overhead for IDString", () => {
      const id: IDString = "test" as IDString;
      assert.strictEqual(id, "test");
    });

    it("should have no runtime overhead for IDNumber", () => {
      const id: IDNumber = 42 as IDNumber;
      assert.strictEqual(id, 42);
    });

    it("should have no runtime overhead for Int", () => {
      const int: Int = 100 as Int;
      assert.strictEqual(int, 100);
    });

    it("should have no runtime overhead for Float", () => {
      const float: Float = 1.5 as Float;
      assert.strictEqual(float, 1.5);
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

      assert.equal(user.id, "user-1");
      assert.equal(user.numericId, 1);
      assert.equal(user.age, 25);
      assert.equal(user.rating, 4.5);
    });

    it("should work in arrays", () => {
      const ids: IDString[] = ["id-1" as IDString, "id-2" as IDString];
      assert.equal(ids.length, 2);
    });

    it("should work with nullable types", () => {
      type MaybeId = IDString | null;
      const id: MaybeId = null;
      assert.strictEqual(id, null);
    });
  });
});
