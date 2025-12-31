import type { DocumentNode } from "graphql";

export const typeDefs: DocumentNode = {
  kind: "Document",
  definitions: [
    {
      kind: "EnumTypeDefinition",
      name: {
        kind: "Name",
        value: "Role",
      },
      values: [
        {
          kind: "EnumValueDefinition",
          name: {
            kind: "Name",
            value: "ADMIN",
          },
        },
        {
          kind: "EnumValueDefinition",
          name: {
            kind: "Name",
            value: "USER",
          },
        },
        {
          kind: "EnumValueDefinition",
          name: {
            kind: "Name",
            value: "GUEST",
          },
        },
      ],
    },
    {
      kind: "EnumTypeDefinition",
      name: {
        kind: "Name",
        value: "Status",
      },
      values: [
        {
          kind: "EnumValueDefinition",
          name: {
            kind: "Name",
            value: "ACTIVE",
          },
        },
        {
          kind: "EnumValueDefinition",
          name: {
            kind: "Name",
            value: "INACTIVE",
          },
        },
        {
          kind: "EnumValueDefinition",
          name: {
            kind: "Name",
            value: "PENDING",
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
            value: "role",
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
            value: "status",
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
