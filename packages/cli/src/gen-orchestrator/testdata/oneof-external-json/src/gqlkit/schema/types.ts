import type { ProviderMetadata } from "../../external/types.js";

/**
 * oneOf input whose member fields use unknown and external Record-like aliases.
 * This validates inline union member resolution in input context and ensures
 * the resulting JSON/JSONObject types are reported by oneOf validation.
 */
export type EventSelectorInput =
  | { payload: unknown }
  | { providerMetadata: ProviderMetadata };
