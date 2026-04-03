import type { ProviderMetadata } from "../../external/types.js";

/**
 * Discriminator union with third-party-style external mapped types.
 * This must map unknown -> JSON and ProviderMetadata -> JSONObject
 * even for inline union members generated into object types.
 */
export type StreamEvent =
  | {
      type: "text-start";
      id: string;
      providerMetadata?: ProviderMetadata;
    }
  | {
      type: "text-end";
      id: string;
      providerMetadata?: ProviderMetadata;
    }
  | {
      type: "tool-input-available";
      toolCallId: string;
      input: unknown;
      providerMetadata?: ProviderMetadata;
    }
  | {
      type: "tool-output-available";
      toolCallId: string;
      output: unknown;
      providerMetadata?: ProviderMetadata;
    };
