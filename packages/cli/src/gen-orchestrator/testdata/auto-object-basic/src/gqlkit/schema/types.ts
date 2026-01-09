/**
 * User type with inline profile object
 */
export type User = {
  id: string;
  name: string;
  /** User's profile information */
  profile: {
    /** User's biography */
    bio: string;
    /**
     * User's website URL
     * @deprecated Use socialLinks instead
     */
    website: string | null;
    age: number;
  };
};
