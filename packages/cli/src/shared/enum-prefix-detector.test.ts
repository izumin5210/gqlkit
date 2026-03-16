import { describe, expect, it } from "vitest";
import {
  buildEnumPrefixCandidate,
  detectEnumPrefix,
  stripEnumPrefix,
  toUpperSnakeCase,
} from "./enum-prefix-detector.js";

describe("toUpperSnakeCase", () => {
  describe("PascalCase enum names", () => {
    it("converts PascalCase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("UserStatus")).toBe("USER_STATUS");
    });

    it("converts multi-word PascalCase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("AccountType")).toBe("ACCOUNT_TYPE");
    });

    it("converts three-word PascalCase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("UserAccountStatus")).toBe("USER_ACCOUNT_STATUS");
    });
  });

  describe("camelCase enum names", () => {
    it("converts camelCase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("userStatus")).toBe("USER_STATUS");
    });

    it("converts multi-word camelCase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("orderStatus")).toBe("ORDER_STATUS");
    });
  });

  describe("UPPER_SNAKE_CASE enum names", () => {
    it("keeps UPPER_SNAKE_CASE as is", () => {
      expect(toUpperSnakeCase("USER_STATUS")).toBe("USER_STATUS");
    });

    it("keeps multi-word UPPER_SNAKE_CASE as is", () => {
      expect(toUpperSnakeCase("ACCOUNT_TYPE")).toBe("ACCOUNT_TYPE");
    });
  });

  describe("single word enum names", () => {
    it("converts single word PascalCase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("Status")).toBe("STATUS");
    });

    it("converts single word lowercase to UPPER_SNAKE_CASE", () => {
      expect(toUpperSnakeCase("status")).toBe("STATUS");
    });

    it("keeps single word UPPER_CASE as is", () => {
      expect(toUpperSnakeCase("STATUS")).toBe("STATUS");
    });
  });

  describe("edge cases", () => {
    it("handles consecutive uppercase letters", () => {
      expect(toUpperSnakeCase("HTTPStatus")).toBe("HTTP_STATUS");
    });

    it("handles consecutive uppercase letters at the end", () => {
      expect(toUpperSnakeCase("StatusHTTP")).toBe("STATUS_HTTP");
    });

    it("handles consecutive uppercase letters in the middle", () => {
      expect(toUpperSnakeCase("UserHTTPStatus")).toBe("USER_HTTP_STATUS");
    });
  });
});

describe("buildEnumPrefixCandidate", () => {
  it("builds prefix candidate from PascalCase enum name", () => {
    expect(buildEnumPrefixCandidate("UserStatus")).toBe("USER_STATUS_");
  });

  it("builds prefix candidate from camelCase enum name", () => {
    expect(buildEnumPrefixCandidate("userStatus")).toBe("USER_STATUS_");
  });

  it("builds prefix candidate from UPPER_SNAKE_CASE enum name", () => {
    expect(buildEnumPrefixCandidate("USER_STATUS")).toBe("USER_STATUS_");
  });

  it("builds prefix candidate from single word enum name", () => {
    expect(buildEnumPrefixCandidate("Status")).toBe("STATUS_");
  });
});

describe("detectEnumPrefix", () => {
  describe("when all values have the prefix", () => {
    it("returns shouldStrip: true with the detected prefix", () => {
      const result = detectEnumPrefix({
        enumName: "UserStatus",
        memberValues: ["USER_STATUS_ACTIVE", "USER_STATUS_INACTIVE"],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "USER_STATUS_",
      });
    });

    it("works with single word enum names", () => {
      const result = detectEnumPrefix({
        enumName: "Status",
        memberValues: ["STATUS_ACTIVE", "STATUS_INACTIVE", "STATUS_PENDING"],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "STATUS_",
      });
    });

    it("works with camelCase enum names", () => {
      const result = detectEnumPrefix({
        enumName: "orderStatus",
        memberValues: ["ORDER_STATUS_PENDING", "ORDER_STATUS_SHIPPED"],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "ORDER_STATUS_",
      });
    });

    it("works with multi-word enum names", () => {
      const result = detectEnumPrefix({
        enumName: "AccountType",
        memberValues: ["ACCOUNT_TYPE_PERSONAL", "ACCOUNT_TYPE_BUSINESS"],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "ACCOUNT_TYPE_",
      });
    });

    it("supports pluralized array element enum names", () => {
      const result = detectEnumPrefix({
        enumName: "PostTag",
        memberValues: [
          "POST_TAGS_TECH",
          "POST_TAGS_LIFESTYLE",
          "POST_TAGS_NEWS",
        ],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "POST_TAGS_",
      });
    });

    it("supports pluralized names ending with category", () => {
      const result = detectEnumPrefix({
        enumName: "PostCategory",
        memberValues: ["POST_CATEGORIES_BLOG", "POST_CATEGORIES_REVIEW"],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "POST_CATEGORIES_",
      });
    });
  });

  describe("when some values do not have the prefix", () => {
    it("returns shouldStrip: false when only some values have the prefix", () => {
      const result = detectEnumPrefix({
        enumName: "UserStatus",
        memberValues: ["USER_STATUS_ACTIVE", "INACTIVE"],
      });
      expect(result).toEqual({
        shouldStrip: false,
        prefix: null,
      });
    });

    it("returns shouldStrip: false when no values have the prefix", () => {
      const result = detectEnumPrefix({
        enumName: "UserStatus",
        memberValues: ["ACTIVE", "INACTIVE"],
      });
      expect(result).toEqual({
        shouldStrip: false,
        prefix: null,
      });
    });
  });

  describe("when stripping would result in empty string", () => {
    it("returns shouldStrip: false when a value equals the prefix exactly", () => {
      const result = detectEnumPrefix({
        enumName: "UserStatus",
        memberValues: ["USER_STATUS_", "USER_STATUS_ACTIVE"],
      });
      expect(result).toEqual({
        shouldStrip: false,
        prefix: null,
      });
    });

    it("returns shouldStrip: false for single value that equals prefix", () => {
      const result = detectEnumPrefix({
        enumName: "Status",
        memberValues: ["STATUS_"],
      });
      expect(result).toEqual({
        shouldStrip: false,
        prefix: null,
      });
    });
  });

  describe("edge cases", () => {
    it("returns shouldStrip: false for empty memberValues", () => {
      const result = detectEnumPrefix({
        enumName: "UserStatus",
        memberValues: [],
      });
      expect(result).toEqual({
        shouldStrip: false,
        prefix: null,
      });
    });

    it("works with single member that has the prefix", () => {
      const result = detectEnumPrefix({
        enumName: "UserStatus",
        memberValues: ["USER_STATUS_ACTIVE"],
      });
      expect(result).toEqual({
        shouldStrip: true,
        prefix: "USER_STATUS_",
      });
    });
  });
});

describe("stripEnumPrefix", () => {
  it("removes the prefix from a value", () => {
    expect(stripEnumPrefix("USER_STATUS_ACTIVE", "USER_STATUS_")).toBe(
      "ACTIVE",
    );
  });

  it("removes prefix from value with multiple underscores", () => {
    expect(stripEnumPrefix("USER_STATUS_NOT_ACTIVE", "USER_STATUS_")).toBe(
      "NOT_ACTIVE",
    );
  });

  it("works with single word prefix", () => {
    expect(stripEnumPrefix("STATUS_ACTIVE", "STATUS_")).toBe("ACTIVE");
  });
});
