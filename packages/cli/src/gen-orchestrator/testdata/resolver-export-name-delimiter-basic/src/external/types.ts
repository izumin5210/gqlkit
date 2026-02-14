/**
 * External post type
 */
export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

/**
 * External comment type
 */
export interface Comment {
  id: string;
  postId: string;
  body: string;
}

/**
 * Input for creating a post
 */
export interface CreatePostInput {
  title: string;
  content: string;
}

/**
 * Input for updating a post
 */
export interface UpdatePostInput {
  title: string | null;
  content: string | null;
}
