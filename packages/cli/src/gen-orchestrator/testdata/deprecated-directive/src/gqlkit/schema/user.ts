export interface User {
  id: string;
  name: string;
  /**
   * @deprecated Use email instead
   */
  emailAddress: string | null;
  /**
   * @deprecated
   */
  legacyField: string | null;
  email: string | null;
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  /**
   * @deprecated Use ACTIVE instead
   */
  LEGACY = "LEGACY",
  /**
   * @deprecated
   */
  OLD = "OLD",
}
