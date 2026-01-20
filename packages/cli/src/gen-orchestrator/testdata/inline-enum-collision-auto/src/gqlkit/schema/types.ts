/**
 * User type with inline profileStatus enum that generates UserProfileStatus type.
 */
export type User = {
  id: string;
  name: string;
  profileStatus: "active" | "inactive" | "pending";
};

/**
 * UserProfile type with inline status enum that also generates UserProfileStatus type.
 * This causes a collision with the auto-generated type from User.profileStatus.
 */
export type UserProfile = {
  displayName: string;
  status: "verified" | "unverified" | "suspended";
};
