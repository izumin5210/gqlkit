import type { ImageUIPart, TextUIPart } from "../../external-lib.js";

/**
 * Message type with a parts field that uses external .d.ts types as union members.
 * Tests that external type names (TextUIPart, ImageUIPart) are preserved
 * instead of auto-generated names (MessagePartsMember0, MessagePartsMember1).
 */
export type Message = {
  id: string;
  parts: TextUIPart | ImageUIPart;
};
