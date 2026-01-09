/**
 * User type with inline profile object that will generate UserProfile type.
 */
export type User = {
  id: string;
  name: string;
  profile: {
    bio: string;
  };
};

/**
 * Explicit UserProfile type that conflicts with auto-generated UserProfile.
 */
export type UserProfile = {
  displayName: string;
  avatar: string;
};
