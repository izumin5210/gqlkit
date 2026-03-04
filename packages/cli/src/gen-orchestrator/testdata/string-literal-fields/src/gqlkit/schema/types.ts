export type StatusEvent = {
  code: "success" | "failure"; // already handled as inline enum
  type: "event"; // single string literal — this is the new case
  numericCode: 200; // number literal
  label: string; // regular string (control)
};
