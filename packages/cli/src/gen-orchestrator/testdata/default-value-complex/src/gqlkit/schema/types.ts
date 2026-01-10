import {
  createGqlkitApis,
  type GqlField,
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
  status: GqlField<Status, { defaultValue: "ACTIVE" }>;
  priorities: GqlField<Priority[], { defaultValue: ["MEDIUM", "HIGH"] }>;
  tags: GqlField<string[], { defaultValue: ["default"] }>;
};

export type SettingsInput = {
  config: GqlField<
    NestedConfig,
    { defaultValue: { enabled: true; value: 100 } }
  >;
  limits: GqlField<Int[], { defaultValue: [10, 20, 30] }>;
};

export type AdvancedInput = {
  nestedArray: GqlField<string[][], { defaultValue: [["a", "b"], ["c", "d"]] }>;
  enumList: GqlField<Status[], { defaultValue: ["ACTIVE", "PENDING"] }>;
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
