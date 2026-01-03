export interface Event {
  id: string;
  name: string;
  createdAt: DateTime;
}

type DateTime = string & { readonly __brand: unique symbol };
