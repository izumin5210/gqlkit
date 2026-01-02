/**
 * User account status
 */
export enum UserStatus {
  /** User is active and can access the system */
  Active = "ACTIVE",
  /** User is temporarily inactive */
  Inactive = "INACTIVE",
  /** User account is suspended */
  Suspended = "SUSPENDED",
  /**
   * User account is pending verification
   * @deprecated Use `Inactive` status instead
   */
  Pending = "PENDING",
}

/**
 * Post publication status
 */
export enum PostStatus {
  Draft = "DRAFT",
  Published = "PUBLISHED",
  Archived = "ARCHIVED",
}
