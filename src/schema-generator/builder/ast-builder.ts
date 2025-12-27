import {
  type DefinitionNode,
  type DocumentNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  Kind,
  type ListTypeNode,
  type NamedTypeNode,
  type NameNode,
  type NonNullTypeNode,
  type ObjectTypeDefinitionNode,
  type ObjectTypeExtensionNode,
  type TypeNode,
  type UnionTypeDefinitionNode,
} from "graphql";
import type { GraphQLInputValue } from "../../resolver-extractor/index.js";
import type { GraphQLFieldType } from "../../type-extractor/types/index.js";
import type {
  BaseField,
  BaseType,
  ExtensionField,
  IntegratedResult,
  TypeExtension,
} from "../integrator/result-integrator.js";

export function buildNameNode(value: string): NameNode {
  return {
    kind: Kind.NAME,
    value,
  };
}

export function buildNamedTypeNode(typeName: string): NamedTypeNode {
  return {
    kind: Kind.NAMED_TYPE,
    name: buildNameNode(typeName),
  };
}

export function buildListTypeNode(
  innerType: NamedTypeNode | NonNullTypeNode,
): ListTypeNode {
  return {
    kind: Kind.LIST_TYPE,
    type: innerType,
  };
}

export function buildNonNullTypeNode(
  innerType: NamedTypeNode | ListTypeNode,
): NonNullTypeNode {
  return {
    kind: Kind.NON_NULL_TYPE,
    type: innerType,
  };
}

export function buildFieldTypeNode(fieldType: GraphQLFieldType): TypeNode {
  const { typeName, nullable, list, listItemNullable } = fieldType;

  if (list) {
    const namedType = buildNamedTypeNode(typeName);

    const itemType =
      listItemNullable === true ? namedType : buildNonNullTypeNode(namedType);

    const listType = buildListTypeNode(itemType);

    return nullable ? listType : buildNonNullTypeNode(listType);
  }

  const namedType = buildNamedTypeNode(typeName);
  return nullable ? namedType : buildNonNullTypeNode(namedType);
}

export function buildInputValueDefinitionNode(
  inputValue: GraphQLInputValue,
): InputValueDefinitionNode {
  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: buildNameNode(inputValue.name),
    type: buildFieldTypeNode(inputValue.type),
  };
}

function sortByName<T extends { name: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function buildBaseFieldDefinitionNode(field: BaseField): FieldDefinitionNode {
  return {
    kind: Kind.FIELD_DEFINITION,
    name: buildNameNode(field.name),
    type: buildFieldTypeNode(field.type),
  };
}

export function buildFieldDefinitionNode(
  field: ExtensionField,
): FieldDefinitionNode {
  return {
    kind: Kind.FIELD_DEFINITION,
    name: buildNameNode(field.name),
    arguments: field.args?.map(buildInputValueDefinitionNode),
    type: buildFieldTypeNode(field.type),
  };
}

export function buildObjectTypeDefinitionNode(
  baseType: BaseType,
): ObjectTypeDefinitionNode {
  const sortedFields = baseType.fields ? sortByName(baseType.fields) : [];
  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    fields: sortedFields.map(buildBaseFieldDefinitionNode),
  };
}

export function buildUnionTypeDefinitionNode(
  baseType: BaseType,
): UnionTypeDefinitionNode {
  const sortedMembers = baseType.unionMembers
    ? [...baseType.unionMembers].sort((a, b) => a.localeCompare(b))
    : [];
  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    types: sortedMembers.map(buildNamedTypeNode),
  };
}

export function buildObjectTypeExtensionNode(
  typeExtension: TypeExtension,
): ObjectTypeExtensionNode {
  const sortedFields = sortByName(typeExtension.fields);
  return {
    kind: Kind.OBJECT_TYPE_EXTENSION,
    name: buildNameNode(typeExtension.targetTypeName),
    fields: sortedFields.map(buildFieldDefinitionNode),
  };
}

export function buildDocumentNode(
  integratedResult: IntegratedResult,
): DocumentNode {
  const definitions: DefinitionNode[] = [];

  const sortedBaseTypes = [...integratedResult.baseTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const baseType of sortedBaseTypes) {
    if (baseType.kind === "Object") {
      definitions.push(buildObjectTypeDefinitionNode(baseType));
    } else {
      definitions.push(buildUnionTypeDefinitionNode(baseType));
    }
  }

  const sortedExtensions = [...integratedResult.typeExtensions].sort((a, b) =>
    a.targetTypeName.localeCompare(b.targetTypeName),
  );

  for (const ext of sortedExtensions) {
    definitions.push(buildObjectTypeExtensionNode(ext));
  }

  return {
    kind: Kind.DOCUMENT,
    definitions,
  };
}
