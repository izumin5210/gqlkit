import type { DocumentNode } from "graphql";

export const typeDefs: DocumentNode = {
  kind: "Document",
  definitions: [
    {
      kind: "ObjectTypeDefinition",
      name: {
        kind: "Name",
        value: "Post",
      },
      fields: [
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "authorId",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "String",
              },
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "id",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "String",
              },
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "title",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "String",
              },
            },
          },
        },
      ],
    },
    {
      kind: "ObjectTypeDefinition",
      name: {
        kind: "Name",
        value: "User",
      },
      fields: [
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "firstName",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "String",
              },
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "id",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "String",
              },
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "lastName",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "String",
              },
            },
          },
        },
      ],
    },
  ],
} as DocumentNode;
