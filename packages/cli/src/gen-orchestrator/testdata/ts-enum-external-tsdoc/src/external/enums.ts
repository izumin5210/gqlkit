/**
 * Represents the visibility level of a post.
 * Controls who can see the content.
 */
export enum PostVisibility {
  /** Anyone can see this content */
  Public = "public",
  /** Only the author can see this content */
  Private = "private",
  /** Only people with the link can see this content */
  Unlisted = "unlisted",
}

/**
 * Status of a user account.
 * @deprecated Use AccountStatus instead for better granularity.
 */
export enum UserStatus {
  /** User is active and can log in */
  Active = "active",
  /** User account is suspended */
  Suspended = "suspended",
  /**
   * User account is pending verification
   * @deprecated Use Unverified instead
   */
  Pending = "pending",
}
