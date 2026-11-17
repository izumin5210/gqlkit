export type Context = {
  /** Records the references the gateway sends, for the example's test. */
  readonly onResolveReference?: (reference: unknown) => void;
};
