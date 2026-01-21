import { describe, expect, it } from "vitest";
import type {
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type {
  InlineUnionMemberInfo,
  InlineUnionWithContext,
} from "./inline-union-types.js";
import type { AutoTypeNameContext } from "./naming-convention.js";

describe("InlineUnionMemberInfo", () => {
  it("should have memberType and needsAutoGeneration properties", () => {
    const memberType: TSTypeReference = {
      kind: "reference",
      name: "TypeA",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
      inlineEnumMembers: null,
      externalEnumSymbol: null,
      externalEnumDescription: null,
      externalEnumDeprecated: null,
    };

    const memberInfo: InlineUnionMemberInfo = {
      memberType,
      needsAutoGeneration: false,
    };

    expect(memberInfo.memberType).toBe(memberType);
    expect(memberInfo.needsAutoGeneration).toBe(false);
  });

  it("should support inline object members that need auto-generation", () => {
    const memberType: TSTypeReference = {
      kind: "inlineObject",
      name: null,
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: [],
      inlineEnumMembers: null,
      externalEnumSymbol: null,
      externalEnumDescription: null,
      externalEnumDeprecated: null,
    };

    const memberInfo: InlineUnionMemberInfo = {
      memberType,
      needsAutoGeneration: true,
    };

    expect(memberInfo.memberType.kind).toBe("inlineObject");
    expect(memberInfo.needsAutoGeneration).toBe(true);
  });
});

describe("InlineUnionWithContext", () => {
  it("should have members, context, sourceLocation, nullable, and isInputContext properties", () => {
    const memberType: TSTypeReference = {
      kind: "reference",
      name: "TypeA",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
      inlineEnumMembers: null,
      externalEnumSymbol: null,
      externalEnumDescription: null,
      externalEnumDeprecated: null,
    };

    const members: InlineUnionMemberInfo[] = [
      { memberType, needsAutoGeneration: false },
    ];

    const context: AutoTypeNameContext = {
      kind: "objectField",
      parentTypeName: "User",
      fieldPath: ["profile"],
    };

    const sourceLocation: SourceLocation = {
      file: "test.ts",
      line: 10,
      column: 5,
    };

    const inlineUnion: InlineUnionWithContext = {
      members,
      context,
      sourceLocation,
      nullable: false,
      isInputContext: false,
    };

    expect(inlineUnion.members).toBe(members);
    expect(inlineUnion.context).toBe(context);
    expect(inlineUnion.sourceLocation).toBe(sourceLocation);
    expect(inlineUnion.nullable).toBe(false);
    expect(inlineUnion.isInputContext).toBe(false);
  });

  it("should support input context for OneOf types", () => {
    const memberType: TSTypeReference = {
      kind: "inlineObject",
      name: null,
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: [],
      inlineEnumMembers: null,
      externalEnumSymbol: null,
      externalEnumDescription: null,
      externalEnumDeprecated: null,
    };

    const members: InlineUnionMemberInfo[] = [
      { memberType, needsAutoGeneration: true },
    ];

    const context: AutoTypeNameContext = {
      kind: "inputField",
      parentTypeName: "CreateUserInput",
      fieldPath: ["data"],
    };

    const sourceLocation: SourceLocation = {
      file: "input.ts",
      line: 20,
      column: 3,
    };

    const inlineUnion: InlineUnionWithContext = {
      members,
      context,
      sourceLocation,
      nullable: true,
      isInputContext: true,
    };

    expect(inlineUnion.isInputContext).toBe(true);
    expect(inlineUnion.nullable).toBe(true);
    expect(inlineUnion.context.kind).toBe("inputField");
  });

  it("should support resolver arg context for OneOf types", () => {
    const memberType: TSTypeReference = {
      kind: "reference",
      name: "AddressInput",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
      inlineEnumMembers: null,
      externalEnumSymbol: null,
      externalEnumDescription: null,
      externalEnumDeprecated: null,
    };

    const members: InlineUnionMemberInfo[] = [
      { memberType, needsAutoGeneration: false },
    ];

    const context: AutoTypeNameContext = {
      kind: "resolverArg",
      resolverType: "mutation",
      fieldName: "createUser",
      argName: "input",
      parentTypeName: null,
      fieldPath: [],
    };

    const sourceLocation: SourceLocation = {
      file: "resolvers.ts",
      line: 30,
      column: 10,
    };

    const inlineUnion: InlineUnionWithContext = {
      members,
      context,
      sourceLocation,
      nullable: false,
      isInputContext: true,
    };

    expect(inlineUnion.isInputContext).toBe(true);
    expect(inlineUnion.context.kind).toBe("resolverArg");
  });
});
