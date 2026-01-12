import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineMutation } = createGqlkitApis<Context>();

export type Result = {
  success: boolean;
};

export const updateSettings = defineMutation<
  {
    settings: {
      notifications: {
        email: boolean;
        push: boolean;
        "0invalid": string;
        __reserved: string;
      };
      privacy: {
        publicProfile: boolean;
        "hyphen-field": string;
      } | null;
    };
  },
  Result
>((_root, args) => ({ success: true }));
