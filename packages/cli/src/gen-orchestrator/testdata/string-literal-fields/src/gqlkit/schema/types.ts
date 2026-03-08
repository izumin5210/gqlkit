export type StatusEvent = {
  code: "success" | "failure"; // already handled as inline enum
  type: "event"; // single string literal — this is the new case
  numericCode: 200; // integer literal → Int
  ratio: 0.5; // non-integer literal → Float
  bigNumber: 5000000000; // exceeds 32-bit Int range → Float
  label: string; // regular string (control)
};
