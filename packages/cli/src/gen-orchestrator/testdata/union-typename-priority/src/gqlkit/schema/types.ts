export interface User {
  __typename: "User";
  $typeName: "UserFromProtobuf";
  id: string;
  name: string;
}

export interface Post {
  __typename: "Post";
  $typeName: "PostFromProtobuf";
  id: string;
  title: string;
}

export type SearchResult = User | Post;
