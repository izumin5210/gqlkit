import {
  createGqlkitApis,
  type GqlFieldDef,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type NestedConfig = {
  enabled: boolean;
  value: Int;
};

export type FilterInput = {
  status: GqlFieldDef<Status, { defaultValue: "ACTIVE" }>;
  priorities: GqlFieldDef<Priority[], { defaultValue: ["MEDIUM", "HIGH"] }>;
  tags: GqlFieldDef<string[], { defaultValue: ["default"] }>;
};

export type SettingsInput = {
  config: GqlFieldDef<
    NestedConfig,
    { defaultValue: { enabled: true; value: 100 } }
  >;
  limits: GqlFieldDef<Int[], { defaultValue: [10, 20, 30] }>;
};

export type AdvancedInput = {
  nestedArray: GqlFieldDef<
    string[][],
    { defaultValue: [["a", "b"], ["c", "d"]] }
  >;
  enumList: GqlFieldDef<Status[], { defaultValue: ["ACTIVE", "PENDING"] }>;
};

export type Task = {
  id: string;
  status: Status;
};

const { defineQuery } = createGqlkitApis();

export const tasks = defineQuery<FilterInput, Task[]>(() => []);

export const settings = defineQuery<SettingsInput, NestedConfig>(() => ({
  enabled: true,
  value: 0,
}));

export const advanced = defineQuery<AdvancedInput, string>(() => "result");
