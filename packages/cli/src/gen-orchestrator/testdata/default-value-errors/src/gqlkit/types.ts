export interface Result {
  id: string;
}

export type Status = "ACTIVE" | "INACTIVE";

export interface TypeMismatchInput {
  /** @defaultValue 123 */
  stringField: string;
  /** @defaultValue "not a number" */
  intField: number;
  /** @defaultValue "not a float" */
  floatField: number;
  /** @defaultValue "not a boolean" */
  boolField: boolean;
  /** @defaultValue null */
  nonNullField: string;
  /** @defaultValue UNKNOWN_VALUE */
  enumField: Status;
  /** @defaultValue "not a list" */
  listField: string[];
}
