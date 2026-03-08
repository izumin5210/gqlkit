export type ToolEvent = {
  type: `tool-${string}`; // simple template literal
  version: `v${number}`; // template literal with number
  label: string; // regular string (control)
  tag: `${string}-${string}`; // complex template literal
};
