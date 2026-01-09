/**
 * User type with deeply nested inline objects
 */
export type User = {
  id: string;
  /** User's profile with nested address */
  profile: {
    bio: string;
    /** Nested address information */
    address: {
      street: string;
      city: string;
      /** Nested location coordinates */
      location: {
        latitude: number;
        longitude: number;
      };
    };
  };
};

/**
 * Input for user with nested structure
 */
export type UserInput = {
  name: string;
  /** Profile input with nested address */
  profile: {
    bio: string | null;
    /** Address input */
    address: {
      street: string;
      city: string;
    } | null;
  };
};
