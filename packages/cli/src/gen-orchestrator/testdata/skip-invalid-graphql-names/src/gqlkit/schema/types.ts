export interface User {
  id: string;
  name: string;
  email: string | null;
  // Invalid field names (should be skipped)
  "0invalid": string;
  __reserved: string;
  "field-with-dash": string;
  "field.with.dot": string;
  "field with space": string;
}

export interface CreateUserInput {
  name: string;
  email?: string;
  // Invalid input field names (should be skipped)
  "123abc": string;
  __private: string;
  "hyphen-field": string;
}

export type UserStatus = "active" | "inactive" | "0pending" | "__internal";

export enum Priority {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  "0INVALID" = "0INVALID",
  __RESERVED = "__RESERVED",
}
