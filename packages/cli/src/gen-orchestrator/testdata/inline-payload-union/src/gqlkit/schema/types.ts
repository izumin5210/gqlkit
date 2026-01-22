import {
  defineField,
  defineIsTypeOf,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "../gqlkit.js";

/**
 * Success result type
 */
export type UserSuccess = {
  id: string;
  name: string;
  email: string;
};

/**
 * Error result for invalid email
 */
export type InvalidEmailError = {
  message: string;
  field: string;
};

/**
 * Error result for not found
 */
export type NotFoundError = {
  message: string;
  requestedId: string;
};

/**
 * Post type for field resolver test
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * Draft state for post
 */
export type DraftState = {
  lastEditedAt: string;
  editorId: string;
};

/**
 * Published state for post
 */
export type PublishedState = {
  publishedAt: string;
  viewCount: number;
};

/**
 * Archived state for post
 */
export type ArchivedState = {
  archivedAt: string;
  reason: string;
};

/**
 * Abstract type resolvers (isTypeOf) for union member types
 */
export const userSuccessIsTypeOf = defineIsTypeOf<UserSuccess>((value) => {
  return typeof value === "object" && value !== null && "email" in value;
});

export const invalidEmailErrorIsTypeOf = defineIsTypeOf<InvalidEmailError>(
  (value) => {
    return typeof value === "object" && value !== null && "field" in value;
  },
);

export const notFoundErrorIsTypeOf = defineIsTypeOf<NotFoundError>((value) => {
  return typeof value === "object" && value !== null && "requestedId" in value;
});

export const draftStateIsTypeOf = defineIsTypeOf<DraftState>((value) => {
  return typeof value === "object" && value !== null && "editorId" in value;
});

export const publishedStateIsTypeOf = defineIsTypeOf<PublishedState>(
  (value) => {
    return typeof value === "object" && value !== null && "viewCount" in value;
  },
);

export const archivedStateIsTypeOf = defineIsTypeOf<ArchivedState>((value) => {
  return typeof value === "object" && value !== null && "archivedAt" in value;
});

/**
 * Query to fetch posts
 */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/**
 * Query returning union of named types.
 * Expected generated type: GetUserPayload (GraphQL Union)
 * Union members: UserSuccess | InvalidEmailError | NotFoundError
 * Tests requirement 3.1 (union detection) and 3.2 (query naming)
 */
export const getUser = defineQuery<
  { id: string },
  UserSuccess | InvalidEmailError | NotFoundError
>((_root, args) => ({
  id: args.id,
  name: "Test User",
  email: "test@example.com",
}));

/**
 * Mutation returning union of named types.
 * Expected generated type: CreateUserPayload (GraphQL Union)
 * Union members: UserSuccess | InvalidEmailError
 * Tests requirement 3.2 (mutation naming)
 */
export const createUser = defineMutation<
  { name: string; email: string },
  UserSuccess | InvalidEmailError
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
}));

/**
 * Field resolver on Post returning union of named types.
 * Expected generated type: PostStatusPayload (GraphQL Union)
 * Union members: DraftState | PublishedState | ArchivedState
 * Tests requirement 3.3 (field resolver naming) and 3.4 (union members)
 */
export const status = defineField<
  Post,
  NoArgs,
  DraftState | PublishedState | ArchivedState
>(() => ({
  publishedAt: "2025-01-01",
  viewCount: 100,
}));

/**
 * Nullable union test - Query returning nullable union of named types.
 * Expected generated type: FindUserPayload (GraphQL Union, nullable)
 */
export const findUser = defineQuery<
  { email: string },
  UserSuccess | NotFoundError | null
>((_root, _args) => null);
