import type { DefineInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * Interface A - implements B (creating circular dependency: A -> B -> C -> A)
 * All interfaces share the same fields to avoid INTERFACE_MISSING_FIELD errors.
 */
export type InterfaceA = DefineInterface<
  {
    id: IDString;
  },
  { implements: [InterfaceB] }
>;

/**
 * Interface B - implements C
 */
export type InterfaceB = DefineInterface<
  {
    id: IDString;
  },
  { implements: [InterfaceC] }
>;

/**
 * Interface C - implements A (completing the cycle)
 */
export type InterfaceC = DefineInterface<
  {
    id: IDString;
  },
  { implements: [InterfaceA] }
>;
