// Simulates external library .d.ts type (like AI SDK's ToolInvocationUIPart)
// TypeScript shares type objects for identical anonymous types when they
// originate from the same generic type instantiation.

type ToolBase = {
  callId: string;
  title?: string | undefined;
};

// The shared input type emerges from generic instantiation
type ToolInput<T> = { query: T };

type InvocationBase<TInput> = ToolBase & {
  input: TInput;
};

type InvocationStates<TInput> =
  | (InvocationBase<TInput> & {
      state: "input-available";
    })
  | (InvocationBase<TInput> & {
      state: "output-available";
      output: { results: string[] };
    })
  | (InvocationBase<TInput> & {
      state: "output-error";
      errorText: string;
    });

export type ToolPart =
  | { type: "text"; content: string }
  | ({ type: "tool-search" } & InvocationStates<ToolInput<string>>);
