import {
  defineField,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

/**
 * Query returning inline payload with deprecated fields.
 */
export const getUser = defineQuery<
  { id: string },
  {
    user: User;
    /**
     * @deprecated Use user.id instead
     */
    userId: string | null;
    /**
     * @deprecated
     */
    legacyField: string | null;
  }
>((_root, _args) => ({
  user: { id: "1", name: "John" },
  userId: null,
  legacyField: null,
}));

/**
 * Mutation returning inline payload with multiple deprecated fields.
 */
export const updateUser = defineMutation<
  { id: string; name: string },
  {
    user: User;
    success: boolean;
    /**
     * Error code for backward compatibility
     * @deprecated Use errors array instead
     */
    errorCode: string | null;
    /**
     * @deprecated
     */
    message: string | null;
  }
>((_root, args) => ({
  user: { id: args.id, name: args.name },
  success: true,
  errorCode: null,
  message: null,
}));

/**
 * Field resolver returning inline payload with deprecated field.
 */
export const profile = defineField<
  User,
  NoArgs,
  {
    bio: string;
    /**
     * @deprecated Use socialLinks field instead
     */
    website: string | null;
  }
>((_parent, _args) => ({
  bio: "Developer",
  website: null,
}));

/**
 * Query returning nested inline object with deprecated field.
 */
export const getOrder = defineQuery<
  { id: string },
  {
    order: {
      id: string;
      /**
       * @deprecated Use status field instead
       */
      legacyStatus: string | null;
      details: {
        /**
         * @deprecated Use total field instead
         */
        amount: number | null;
        total: number;
      };
    };
  }
>((_root, _args) => ({
  order: {
    id: "order-1",
    legacyStatus: null,
    details: {
      amount: null,
      total: 100,
    },
  },
}));

/**
 * Deprecated query that returns inline payload.
 * @deprecated Use getUser query instead
 */
export const legacyGetUser = defineQuery<
  NoArgs,
  {
    user: User | null;
    found: boolean;
  }
>(() => ({
  user: null,
  found: false,
}));
