export type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export interface Product {
  id: string;
  name: string;
  status: Status;
}

export interface Point {
  x: number;
  y: number;
}

export interface SearchInput {
  /** @defaultValue ACTIVE */
  status: Status;
  /** @defaultValue ["tag1", "tag2"] */
  tags: string[];
  /** @defaultValue { x: 0, y: 0 } */
  origin: Point;
  /** @defaultValue [1, 2, 3] */
  scores: number[];
}
