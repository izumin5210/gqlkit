/**
 * Type whose field is an inline object containing unknown/Record types.
 * Scalar detection must traverse inlineObjectProperties to find JSON/JSONObject.
 */
export type Container = {
  label: string;
  nested: {
    payload: unknown;
    metadata: Record<string, unknown>;
  };
};
