/**
 * Represents a single directive argument value.
 */
export type DirectiveArgumentValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "null"; readonly value: null }
  | { readonly kind: "enum"; readonly value: string }
  | {
      readonly kind: "list";
      readonly values: ReadonlyArray<DirectiveArgumentValue>;
    }
  | {
      readonly kind: "object";
      readonly fields: ReadonlyArray<DirectiveArgument>;
    };

/**
 * Represents a directive argument (name-value pair).
 */
export interface DirectiveArgument {
  readonly name: string;
  readonly value: DirectiveArgumentValue;
}

/**
 * Represents a detected directive with its name and arguments.
 */
export interface DirectiveInfo {
  readonly name: string;
  readonly args: ReadonlyArray<DirectiveArgument>;
}

export interface DeprecationInfo {
  readonly isDeprecated: true;
  readonly reason: string | null;
}
