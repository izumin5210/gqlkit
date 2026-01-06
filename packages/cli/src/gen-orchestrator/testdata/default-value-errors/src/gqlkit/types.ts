export interface Result {
  id: string;
}

export interface InvalidDefaultInput {
  /** @defaultValue invalid_syntax_here */
  field1: string;
  /** @defaultValue */
  field2: string;
}
