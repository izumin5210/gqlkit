import type { DocumentNode } from "graphql";

export const typeDefs: DocumentNode = {
  kind: "Document",
  definitions: [
    {
      kind: "ObjectTypeDefinition",
      name: {
        kind: "Name",
        value: "Mutation",
      },
      fields: [],
    },
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
        value: "Query",
      },
      fields: [],
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
      ],
    },
    {
      kind: "ObjectTypeExtension",
      name: {
        kind: "Name",
        value: "Mutation",
      },
      fields: [
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "createUser",
          },
          arguments: [
            {
              kind: "InputValueDefinition",
              name: {
                kind: "Name",
                value: "input",
              },
              type: {
                kind: "NonNullType",
                type: {
                  kind: "NamedType",
                  name: {
                    kind: "Name",
                    value: "CreateUserInput",
                  },
                },
              },
            },
          ],
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "User",
              },
            },
          },
        },
      ],
    },
    {
      kind: "ObjectTypeExtension",
      name: {
        kind: "Name",
        value: "Query",
      },
      fields: [
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "allUsers",
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
                    value: "User",
                  },
                },
              },
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "me",
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "User",
              },
            },
          },
        },
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "user",
          },
          arguments: [
            {
              kind: "InputValueDefinition",
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
          ],
          type: {
            kind: "NamedType",
            name: {
              kind: "Name",
              value: "User",
            },
          },
        },
      ],
    },
    {
      kind: "ObjectTypeExtension",
      name: {
        kind: "Name",
        value: "User",
      },
      fields: [
        {
          kind: "FieldDefinition",
          name: {
            kind: "Name",
            value: "displayName",
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
            value: "posts_",
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
