// TypeScript 7 ships the AST and the checker client as separate entry points;
// merging them keeps a single `ts` namespace across the CLI.
export * from "typescript/ast";
// Both entry points export these enums, so `export *` alone leaves them
// ambiguous.
/** @lintignore */
export { ModifierFlags, ScriptKind } from "typescript/ast";
export * from "typescript/async";
