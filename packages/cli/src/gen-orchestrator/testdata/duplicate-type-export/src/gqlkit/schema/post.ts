// Second (conflicting) definition of User in post.ts
export interface User {
  id: string;
  displayName: string;
  age: number;
}

export interface Post {
  id: string;
  title: string;
  author: User;
}
