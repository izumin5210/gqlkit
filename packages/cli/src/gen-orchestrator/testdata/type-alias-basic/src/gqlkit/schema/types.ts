import type {
  InternalCreateProductInput,
  InternalProduct,
} from "../../internal/types.js";

interface InternalUser {
  id: string;
  name: string;
  email: string | null;
}

interface InternalCreateUserInput {
  name: string;
  email?: string;
}

export type User = InternalUser;

export type CreateUserInput = InternalCreateUserInput;

export type Product = InternalProduct;

export type CreateProductInput = InternalCreateProductInput;
