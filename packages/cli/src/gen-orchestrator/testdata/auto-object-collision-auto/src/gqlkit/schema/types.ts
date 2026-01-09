/**
 * User type with inline profileDetails that generates UserProfileDetails type.
 */
export type User = {
  id: string;
  name: string;
  profileDetails: {
    bio: string;
    age: number;
  };
};

/**
 * UserProfile type with inline details that also generates UserProfileDetails type.
 * This causes a collision with the auto-generated type from User.profileDetails.
 */
export type UserProfile = {
  displayName: string;
  details: {
    location: string;
    website: string | null;
  };
};
