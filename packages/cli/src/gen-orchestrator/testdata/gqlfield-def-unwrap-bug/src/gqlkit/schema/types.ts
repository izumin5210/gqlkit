import {
  createGqlkitApis,
  type GqlFieldDef,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

// Bug 1: Type reference (NestedConfig) should resolve to actual type name, not __type
export type NestedConfig = {
  enabled: boolean;
  value: Int;
};

// Bug 2: Array type (Int[]) should preserve list wrapper, not flatten to scalar
export type SettingsInput = {
  // Bug 1: config should be NestedConfig!, but resolves to __type!
  config: GqlFieldDef<
    NestedConfig,
    { defaultValue: { enabled: true; value: 100 } }
  >;
  // Bug 2: limits should be [Int!]!, but resolves to Int!
  limits: GqlFieldDef<Int[], { defaultValue: [10, 20, 30] }>;
};

// Additional test case: array of type references
export type Tag = {
  name: string;
};

export type AdvancedInput = {
  // Bug 1 + Bug 2 combined: should be [Tag!]!
  tags: GqlFieldDef<Tag[], { defaultValue: [{ name: "default" }] }>;
};

export type Settings = {
  name: string;
  config: NestedConfig;
};

const { defineQuery } = createGqlkitApis();

export const settings = defineQuery<SettingsInput, Settings>(() => ({
  name: "test",
  config: { enabled: true, value: 0 },
}));

export const advanced = defineQuery<AdvancedInput, string>(() => "result");
