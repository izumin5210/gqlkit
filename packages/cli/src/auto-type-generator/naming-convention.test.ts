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
    it("generates {PascalCaseFieldName}Input for args named 'input' (avoids InputInput duplication)", () => {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "createUser",
        argName: "input",
        parentTypeName: null,
        fieldPath: [],
      };
      expect(generateAutoTypeName(context)).toBe("CreateUserInput");
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

  describe("Resolver payload naming", () => {
    describe("Query/Mutation payload naming", () => {
      it("generates {PascalCaseFieldName}Payload for query payload", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "query",
          fieldName: "getUser",
          parentTypeName: null,
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("GetUserPayload");
      });

      it("generates {PascalCaseFieldName}Payload for mutation payload", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "mutation",
          fieldName: "updateUser",
          parentTypeName: null,
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("UpdateUserPayload");
      });

      it("converts camelCase field names to PascalCase", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "mutation",
          fieldName: "createNewUser",
          parentTypeName: null,
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("CreateNewUserPayload");
      });

      it("converts snake_case field names to PascalCase", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "query",
          fieldName: "get_user_profile",
          parentTypeName: null,
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("GetUserProfilePayload");
      });
    });

    describe("Field resolver payload naming", () => {
      it("generates {ParentTypeName}{PascalCaseFieldName}Payload for field resolver payload", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "field",
          fieldName: "profile",
          parentTypeName: "User",
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("UserProfilePayload");
      });

      it("preserves PascalCase parent type name", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "field",
          fieldName: "posts",
          parentTypeName: "BlogAuthor",
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("BlogAuthorPostsPayload");
      });

      it("converts camelCase field names to PascalCase", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "field",
          fieldName: "socialLinks",
          parentTypeName: "User",
          fieldPath: [],
        };
        expect(generateAutoTypeName(context)).toBe("UserSocialLinksPayload");
      });
    });

    describe("Nested payload type naming", () => {
      it("generates {PayloadTypeName}{PascalCaseFieldName} for nested object in query payload (no Input suffix)", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "query",
          fieldName: "getUser",
          parentTypeName: null,
          fieldPath: ["profile"],
        };
        expect(generateAutoTypeName(context)).toBe("GetUserPayloadProfile");
      });

      it("generates {PayloadTypeName}{PascalCaseFieldPath} for deeply nested types", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "mutation",
          fieldName: "updateUser",
          parentTypeName: null,
          fieldPath: ["profile", "address"],
        };
        expect(generateAutoTypeName(context)).toBe(
          "UpdateUserPayloadProfileAddress",
        );
      });

      it("generates {ParentTypeName}{FieldName}Payload{FieldPath} for nested in field resolver payload", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "field",
          fieldName: "details",
          parentTypeName: "User",
          fieldPath: ["metadata"],
        };
        expect(generateAutoTypeName(context)).toBe(
          "UserDetailsPayloadMetadata",
        );
      });

      it("handles multiple nesting levels", () => {
        const context: AutoTypeNameContext = {
          kind: "resolverPayload",
          resolverType: "query",
          fieldName: "getOrganization",
          parentTypeName: null,
          fieldPath: ["settings", "billing", "address"],
        };
        expect(generateAutoTypeName(context)).toBe(
          "GetOrganizationPayloadSettingsBillingAddress",
        );
      });
    });
  });
});
