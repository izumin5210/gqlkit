const toolOutput = {
  condition: "" as string,
  location: "" as string,
  temperature: 0 as number,
};

const toolResult = {
  name: "" as string,
  output: toolOutput,
};

/**
 * Message type with a field derived via typeof from an object literal.
 * TypeScript assigns the `__object` internal symbol to such types,
 * which should be treated as inline objects and auto-named.
 */
export type Message = {
  id: string;
  result: typeof toolResult;
};
