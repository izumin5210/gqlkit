type Simplify<T> = { [K in keyof T]: T[K] } & {};

interface InternalUser {
  id: number;
  name: string;
}

export type User = Simplify<InternalUser>;

export interface Post {
  id: number;
  title: string;
  author: User;
}
