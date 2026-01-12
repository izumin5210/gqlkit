import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery, defineMutation } = createGqlkitApis<Context>();

/**
 * Base contact info type
 */
interface ContactInfo {
  /** Email address for contact */
  email: string;
  /** Phone number for contact */
  phone: string;
}

/**
 * Base address info type
 */
interface AddressInfo {
  /** City name */
  city: string;
  /** Country name */
  country: string;
  /** Postal code */
  postalCode: string;
}

/**
 * Type with deprecated fields for testing metadata inheritance
 */
interface LegacyInfo {
  /**
   * Old identifier
   * @deprecated Use newId instead
   */
  oldId: string;
  /** New identifier */
  newId: string;
  /**
   * @deprecated No longer supported
   */
  legacyField: boolean;
}

/**
 * Additional profile fields
 */
interface ProfileExtras {
  /** User's biography */
  bio: string;
  /** User's website URL */
  website: string | null;
}

/**
 * Person type testing basic intersection of two interfaces.
 * Tests Requirement 3.3: intersection type (A & B) handling.
 */
export type Person = {
  id: string;
  name: string;
  /**
   * Contact and address info combined via intersection.
   * Verifies that properties from both types are correctly merged.
   */
  info: ContactInfo & AddressInfo;
};

/**
 * Employee type testing intersection with utility types.
 * Tests Pick<A> & Pick<B> combination.
 */
export type Employee = {
  id: string;
  name: string;
  /**
   * Selected fields from contact and address.
   * Uses Pick on both types before intersection.
   */
  partialInfo: Pick<ContactInfo, "email"> &
    Pick<AddressInfo, "city" | "country">;
};

/**
 * Customer type testing Omit & intersection combination.
 * Tests Omit<A> & B pattern.
 */
export type Customer = {
  id: string;
  name: string;
  /**
   * Contact info without phone, plus additional profile.
   * Uses Omit to exclude phone, then intersects with extras.
   */
  profile: Omit<ContactInfo, "phone"> & ProfileExtras;
};

/**
 * Member type testing metadata inheritance from intersection.
 * Tests Requirement 5.3: metadata inheritance from multiple sources.
 */
export type Member = {
  id: string;
  name: string;
  /**
   * Legacy info with deprecated fields plus profile extras.
   * Verifies deprecated tags are inherited from first type in intersection.
   */
  legacyProfile: Pick<LegacyInfo, "oldId" | "legacyField"> &
    Pick<ProfileExtras, "bio">;
};

/**
 * Result type for queries
 */
export type Result = {
  id: string;
  success: boolean;
};

/**
 * Simple query to get all results
 */
export const allResults = defineQuery<NoArgs, Result[]>(() => []);

/**
 * Test direct intersection type in resolver args.
 * Combines contact and address info as arguments.
 */
export const createPersonWithIntersection = defineMutation<
  ContactInfo & AddressInfo,
  Result
>((_root, _args) => ({
  id: "1",
  success: true,
}));

/**
 * Test Pick with intersection in resolver args.
 * Uses Pick<A> & Pick<B> pattern directly.
 */
export const createEmployeeWithPickIntersection = defineMutation<
  Pick<ContactInfo, "email" | "phone"> & Pick<AddressInfo, "city">,
  Result
>((_root, _args) => ({
  id: "1",
  success: true,
}));

/**
 * Test Omit with intersection in resolver args.
 * Uses Omit<A> & B pattern directly.
 */
export const createCustomerWithOmitIntersection = defineMutation<
  Omit<ContactInfo, "phone"> & ProfileExtras,
  Result
>((_root, _args) => ({
  id: "1",
  success: true,
}));

/**
 * Test metadata inheritance with intersection in resolver args.
 * Verifies deprecated tags are preserved.
 */
export const updateMemberWithDeprecated = defineMutation<
  Pick<LegacyInfo, "oldId" | "newId"> & Pick<ProfileExtras, "bio">,
  Result
>((_root, _args) => ({
  id: "1",
  success: true,
}));

/**
 * Test wrapped intersection with different structure in input object.
 * Uses Pick to select different fields than the object type field.
 */
export const createWithWrappedIntersection = defineMutation<
  {
    /** Selected contact and address fields */
    input: Pick<ContactInfo, "email"> &
      Pick<AddressInfo, "city" | "postalCode">;
  },
  Result
>((_root, _args) => ({
  id: "1",
  success: true,
}));

/**
 * Test three-way intersection.
 * Combines three types together.
 */
export const createWithTripleIntersection = defineMutation<
  Pick<ContactInfo, "email"> &
    Pick<AddressInfo, "city"> &
    Pick<ProfileExtras, "bio">,
  Result
>((_root, _args) => ({
  id: "1",
  success: true,
}));
