/**
 * Test case: discriminator-aware intersection flattening
 *
 * TypeScript distributes intersections over unions, so `{ type: "tool-a" } & InvocationStates`
 * expands to 4 inline objects. With 2 tools + 1 simple part, the union has 9 inline members.
 * The discriminator field "type" groups and flattens them into 3 members:
 * - ActionPartText (type="text")
 * - ActionPartToolA (type="tool-a")
 * - ActionPartToolB (type="tool-b")
 */

type BaseInvocation = { callId: string; title: string | null };
type InvocationStates =
  | { state: "pending"; input: string; output?: never }
  | { state: "running"; input: string; output?: never }
  | { state: "done"; input: string; output: string }
  | {
      state: "error";
      input: string | undefined;
      output?: never;
      errorText: string;
    };

export type ActionPart =
  | { type: "text"; content: string }
  | ({ type: "tool-a" } & BaseInvocation & InvocationStates)
  | ({ type: "tool-b" } & BaseInvocation & InvocationStates);

export type Container = { parts: ActionPart[] };
