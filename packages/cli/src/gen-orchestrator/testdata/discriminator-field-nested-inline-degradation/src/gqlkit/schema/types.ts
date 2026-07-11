/**
 * Test case: legacy degradation of nested inline types inside
 * discriminator-based union members.
 *
 * `Event`'s members are anonymous inline objects reached through
 * `discriminatorFields` (config.json: `{ "Event": "type" }`), the same code
 * path `examples/with-ai-sdk`'s `ChatStreamChunk` union goes through (there,
 * `discriminatorFields` also targets a "type" field whose members come from
 * an external package's .d.ts). That path assembles each member's GraphQL
 * object type through a legacy field converter — preserved byte-for-byte
 * from the pre-refactor `inline-object-converter.ts` — that only understands
 * `array`/`reference`/`primitive`/`scalar`-kind properties. It never learned
 * to resolve *nested* inline types, so properties of other kinds silently
 * degrade to `String` instead of becoming their own generated types:
 *
 * - `EventChart.data` is a nested inline object ({ title, value }) — degrades
 *   to `String` instead of a generated `EventChartData` object type.
 * - `EventFinish.reason` is a string-literal union ("stop" | "error") —
 *   degrades to `String` instead of a generated `EventFinishReason` enum.
 *
 * This is a known, pre-existing limitation (see
 * `auto-type-generator/auto-generated-type.ts`'s `convertUnionMemberPropertyType`),
 * not something this test asserts is correct — it only pins today's output so
 * the degradation can't silently change (e.g. start leaking
 * `__INLINE_OBJECT__`/`__INLINE_ENUM__` sentinels, as it briefly did during a
 * refactor) without a deliberate, reviewed snapshot update.
 */

export type Event =
  | {
      type: "chart";
      data: { title: string; value: number };
    }
  | {
      type: "finish";
      reason: "stop" | "error";
    };
