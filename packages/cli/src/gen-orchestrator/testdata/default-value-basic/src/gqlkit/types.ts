export interface User {
  id: string;
  name: string;
}

export interface CreateUserInput {
  /** @defaultValue "Guest" */
  name: string;
  /** @defaultValue 18 */
  age: number;
  /** @defaultValue 1.5 */
  rating: number;
  /** @defaultValue true */
  active: boolean;
  /** @defaultValue null */
  bio: string | null;
}
