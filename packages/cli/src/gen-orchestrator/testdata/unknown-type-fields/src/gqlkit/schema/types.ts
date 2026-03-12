/**
 * Type with unknown fields that should map to JSON scalar.
 */
export type FlexibleData = {
  payload: unknown;
  items: unknown[];
  name: string;
};

/**
 * Type with index signature fields that should map to JSONObject scalar.
 */
export type MetadataContainer = {
  label: string;
  metadata: Record<string, unknown>;
  config: { [key: string]: string };
};
