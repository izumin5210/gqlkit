export interface User {
  id: string;
  name: string;
}

export type Wrapper<T> = {
  value: T;
  timestamp: string;
};
