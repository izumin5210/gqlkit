export interface Product {
  id: string;
  name: string;
}

export type MultiplePropertiesInput =
  | { id: string; name: string }
  | { code: string };

export type EmptyObjectInput = {} | { id: string };

export type DuplicatePropertyInput = { id: string } | { id: number };

export type InvalidTypeInput = { product: Product } | { id: string };

export interface ByIdInput {
  id: string;
}

export interface ByNameInput {
  name: string;
}

export type NamedTypeUnionInput = ByIdInput | ByNameInput;

export type MixedMembersInput = { id: string } | ByNameInput;
