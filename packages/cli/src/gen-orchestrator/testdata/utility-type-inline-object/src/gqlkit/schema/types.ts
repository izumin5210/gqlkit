interface BaseProfile {
  /** User's biography */
  bio: string;
  /** User's email address */
  email: string;
  /** User's phone number */
  phone: string;
  /** User's age */
  age: number;
}

/**
 * User type with intersection inline object
 */
export type User = {
  id: string;
  name: string;
  /**
   * Profile merged from base and additional fields using intersection type.
   * This tests the intersection type handling in extractInlineObjectProperties.
   */
  profile: BaseProfile & {
    /** User's website URL */
    website: string | null;
  };
};

/**
 * Post type with Omit inline object.
 * Tests Requirement 3.1: Omit<T, K> for inline object types.
 */
export type Post = {
  id: string;
  title: string;
  /**
   * Author info with some fields omitted.
   * Uses Omit to exclude phone and age from BaseProfile.
   */
  author: Omit<BaseProfile, "phone" | "age">;
};

/**
 * Comment type with Pick inline object.
 * Tests Requirement 3.2: Pick<T, K> for inline object types.
 */
export type Comment = {
  id: string;
  content: string;
  /**
   * Commenter info with only selected fields.
   * Uses Pick to select bio and email from BaseProfile.
   */
  commenter: Pick<BaseProfile, "bio" | "email">;
};

/**
 * Article type combining Omit with intersection type.
 * Tests auto-type-generator handling of complex utility type combinations.
 */
export type Article = {
  id: string;
  headline: string;
  /**
   * Editor profile combining Omit with additional fields.
   * This tests that auto-type-generator correctly processes utility types.
   */
  editor: Omit<BaseProfile, "phone"> & {
    /** Editor's role in the publication */
    role: string;
  };
};
