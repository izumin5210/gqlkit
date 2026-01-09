import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineMutation } = createGqlkitApis<Context>();

export type Result = {
  success: boolean;
};

/**
 * Update user settings with nested inline objects
 */
export const updateSettings = defineMutation<
  {
    /** Settings to update */
    settings: {
      /** Notification preferences */
      notifications: {
        /** Email notifications enabled */
        email: boolean;
        /** Push notifications enabled */
        push: boolean;
      };
      /** Privacy settings */
      privacy: {
        /** Profile is public */
        publicProfile: boolean;
      } | null;
    };
  },
  Result
>((_root, args) => ({ success: true }));
