export interface User {
  $typeName: "User";
  id: string;
  name: string;
}

export interface Post {
  $typeName: "Post";
  id: string;
  title: string;
}

export type SearchResult = User | Post;
