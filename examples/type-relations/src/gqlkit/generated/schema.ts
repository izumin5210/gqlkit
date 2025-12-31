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
            value: "author",
          },
          type: {
            kind: "NamedType",
            name: {
              kind: "Name",
              value: "User",
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "content",
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
            value: "email",
          },
          type: {
            kind: "NamedType",
            name: {
              kind: "Name",
              value: "String",
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
            value: "name",
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
            value: "posts",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: {
                kind: "NonNullType",
                type: {
                  kind: "NamedType",
                  name: {
                    kind: "Name",
                    value: "Post",
                  },
                },
              },
            },
          },
        },
      ],
    },
  ],
} as DocumentNode;
