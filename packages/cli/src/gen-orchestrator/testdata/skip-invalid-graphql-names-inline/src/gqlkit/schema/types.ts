import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export type Post = {
  id: string;
  title: string;
};

export const users = defineQuery<NoArgs, User[]>(() => []);

export const createUser = defineMutation<
  {
    data: {
      name: string;
      email: string | null;
      "0invalid": string;
      __reserved: string;
      "field-with-dash": string;
    };
  },
  User
>((_root, args) => ({
  id: "1",
  name: args.data.name,
}));

export const searchUsers = defineQuery<
  {
    filter: {
      namePattern: string | null;
      "123abc": string;
      __private: string;
    };
    pagination: {
      page: number;
      limit: number;
      "invalid.field": string;
    };
  },
  User[]
>((_root, args) => []);

export const posts = defineField<
  User,
  {
    filter: {
      titlePattern: string | null;
      "0startWithNumber": string;
      __hidden: string;
    } | null;
  },
  Post[]
>((parent, args) => []);
