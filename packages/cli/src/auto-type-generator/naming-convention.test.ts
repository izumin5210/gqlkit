import { describe, expect, it } from "vitest";
import {
  type AutoTypeNameContext,
  generateAutoTypeName,
} from "./naming-convention.js";

describe("generateAutoTypeName", () => {
  describe("Object type field naming", () => {
    it("generates {ParentTypeName}{PascalCaseFieldName} for object type fields", () => {
      const context: AutoTypeNameContext = {
        kind: "objectField",
        parentTypeName: "User",
        fieldPath: ["profile"],
      };
      expect(generateAutoTypeName(context)).toBe("UserProfile");
    });

    it("handles nested object fields by accumulating path", () => {
      const context: AutoTypeNameContext = {
        kind: "objectField",
        parentTypeName: "User",
        fieldPath: ["profile", "address"],
      };
      expect(generateAutoTypeName(context)).toBe("UserProfileAddress");
    });

    it("handles deeply nested object fields", () => {
      const context: AutoTypeNameContext = {
        kind: "objectField",
        parentTypeName: "User",
        fieldPath: ["profile", "address", "location"],
      };
      expect(generateAutoTypeName(context)).toBe("UserProfileAddressLocation");
    });

    it("converts camelCase field names to PascalCase", () => {
      const context: AutoTypeNameContext = {
        kind: "objectField",
        parentTypeName: "User",
        fieldPath: ["socialLinks"],
      };
      expect(generateAutoTypeName(context)).toBe("UserSocialLinks");
    });

    it("converts snake_case field names to PascalCase", () => {
      const context: AutoTypeNameContext = {
        kind: "objectField",
        parentTypeName: "User",
        fieldPath: ["social_links"],
      };
      expect(generateAutoTypeName(context)).toBe("UserSocialLinks");
    });
  });

  describe("Input type field naming", () => {
    it("generates {ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input for input type fields", () => {
      const context: AutoTypeNameContext = {
        kind: "inputField",
        parentTypeName: "CreateUserInput",
        fieldPath: ["profile"],
      };
      expect(generateAutoTypeName(context)).toBe("CreateUserProfileInput");
    });

    it("handles nested input fields by accumulating path", () => {
      const context: AutoTypeNameContext = {
        kind: "inputField",
        parentTypeName: "CreateUserInput",
        fieldPath: ["profile", "address"],
      };
      expect(generateAutoTypeName(context)).toBe(
        "CreateUserProfileAddressInput",
      );
    });

    it("handles parent type without Input suffix (uses parent name as-is)", () => {
      const context: AutoTypeNameContext = {
        kind: "inputField",
        parentTypeName: "UserData",
        fieldPath: ["profile"],
      };
      expect(generateAutoTypeName(context)).toBe("UserDataProfileInput");
    });
  });

  describe("Query/Mutation resolver argument naming", () => {
    it("generates {PascalCaseFieldName}{PascalCaseArgName}Input for query args", () => {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "createUser",
        argName: "input",
        parentTypeName: null,
        fieldPath: [],
      };
      expect(generateAutoTypeName(context)).toBe("CreateUserInputInput");
    });

    it("generates {PascalCaseFieldName}{PascalCaseArgName}Input for mutation args", () => {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType: "mutation",
        fieldName: "updateUser",
        argName: "data",
        parentTypeName: null,
        fieldPath: [],
      };
      expect(generateAutoTypeName(context)).toBe("UpdateUserDataInput");
    });

    it("handles nested args by accumulating path", () => {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType: "mutation",
        fieldName: "updateSettings",
        argName: "settings",
        parentTypeName: null,
        fieldPath: ["notifications"],
      };
      expect(generateAutoTypeName(context)).toBe(
        "UpdateSettingsSettingsNotificationsInput",
      );
    });
  });

  describe("Field resolver argument naming", () => {
    it("generates {ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input for field resolver args", () => {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType: "field",
        fieldName: "posts",
        argName: "filter",
        parentTypeName: "User",
        fieldPath: [],
      };
      expect(generateAutoTypeName(context)).toBe("UserPostsFilterInput");
    });

    it("handles nested field resolver args", () => {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType: "field",
        fieldName: "posts",
        argName: "filter",
        parentTypeName: "User",
        fieldPath: ["options"],
      };
      expect(generateAutoTypeName(context)).toBe("UserPostsFilterOptionsInput");
    });
  });
});
