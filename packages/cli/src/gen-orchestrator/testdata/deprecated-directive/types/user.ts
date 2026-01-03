export interface User {
  id: string;
  name: string;
  /**
   * @deprecated Use email instead
   */
  emailAddress: string | null;
  email: string | null;
}
