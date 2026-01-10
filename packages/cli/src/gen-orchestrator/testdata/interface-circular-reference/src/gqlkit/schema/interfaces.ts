import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * Interface A - implements B (creating circular dependency: A -> B -> C -> A)
 * All interfaces share the same fields to avoid INTERFACE_MISSING_FIELD errors.
 */
export type InterfaceA = GqlInterface<
  {
    id: IDString;
  },
  { implements: [InterfaceB] }
>;

/**
 * Interface B - implements C
 */
export type InterfaceB = GqlInterface<
  {
    id: IDString;
  },
  { implements: [InterfaceC] }
>;

/**
 * Interface C - implements A (completing the cycle)
 */
export type InterfaceC = GqlInterface<
  {
    id: IDString;
  },
  { implements: [InterfaceA] }
>;
