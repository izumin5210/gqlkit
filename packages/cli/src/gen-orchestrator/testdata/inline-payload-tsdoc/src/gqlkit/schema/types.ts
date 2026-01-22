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
 * Mutation returning inline object type with field-level TSDoc and deprecated fields.
 */
export const createUser = defineMutation<
  { name: string },
  {
    /** The created user */
    user: User;
    /** Operation success flag */
    success: boolean;
    /**
     * Request ID for tracking
     * @deprecated Use traceId from context instead
     */
    requestId: string | null;
  }
>((_root, args) => ({
  user: { id: "1", name: args.name },
  success: true,
  requestId: null,
}));

/**
 * Field resolver with TSDoc on fields.
 */
export const stats = defineField<
  User,
  NoArgs,
  {
    /** Total post count */
    postCount: number;
    /** Total follower count */
    followerCount: number;
    /**
     * Legacy activity score
     * @deprecated Use the activityMetrics field instead
     */
    activityScore: number | null;
  }
>((_parent, _args) => ({
  postCount: 10,
  followerCount: 5,
  activityScore: null,
}));

/**
 * Query with nested inline objects and TSDoc
 */
export const getOrder = defineQuery<
  { id: string },
  {
    /** Order info */
    order: {
      /** Order ID */
      id: string;
      /** Shipping details */
      shipping: {
        /** Tracking number */
        trackingNumber: string;
      };
    };
  }
>((_root, _args) => ({
  order: {
    id: "order-1",
    shipping: { trackingNumber: "TRACK-123" },
  },
}));

/**
 * Payload type with type-level TSDoc documentation.
 * This description should be reflected in the generated GraphQL type.
 */
type UpdateUserPayloadDef = {
  /** The updated user entity */
  user: User;
  /** Indicates whether the update was successful */
  success: boolean;
};

/**
 * Mutation using a type alias with TSDoc for type-level documentation.
 */
export const updateUser = defineMutation<
  { id: string; name: string },
  UpdateUserPayloadDef
>((_root, args) => ({
  user: { id: args.id, name: args.name },
  success: true,
}));
