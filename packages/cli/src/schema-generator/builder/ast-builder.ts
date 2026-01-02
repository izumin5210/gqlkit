import {
  type ConstArgumentNode,
  type ConstDirectiveNode,
  type DefinitionNode,
  type DocumentNode,
  type EnumTypeDefinitionNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type InputObjectTypeDefinitionNode,
  type InputValueDefinitionNode,
  Kind,
  type ListTypeNode,
  type NamedTypeNode,
  type NameNode,
  type NonNullTypeNode,
  type ObjectTypeDefinitionNode,
  type ObjectTypeExtensionNode,
  type ScalarTypeDefinitionNode,
  type StringValueNode,
  type TypeNode,
  type UnionTypeDefinitionNode,
} from "graphql";
import type { GraphQLInputValue } from "../../resolver-extractor/index.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
import type {
  EnumValueInfo,
  GraphQLFieldType,
} from "../../type-extractor/types/index.js";
import type {
  BaseField,
  BaseType,
  ExtensionField,
  InputType,
  IntegratedResult,
  TypeExtension,
} from "../integrator/result-integrator.js";

export function buildNameNode(value: string): NameNode {
  return {
    kind: Kind.NAME,
    value,
  };
}

export function buildStringValueNode(value: string): StringValueNode {
  return {
    kind: Kind.STRING,
    value,
    block: false,
  };
}

export function buildDeprecatedDirective(
  deprecated: DeprecationInfo,
): ConstDirectiveNode {
  const args: ConstArgumentNode[] = [];

  if (deprecated.reason) {
    args.push({
      kind: Kind.ARGUMENT,
      name: buildNameNode("reason"),
      value: buildStringValueNode(deprecated.reason),
    });
  }

  return {
    kind: Kind.DIRECTIVE,
    name: buildNameNode("deprecated"),
    ...(args.length > 0 ? { arguments: args } : {}),
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
  const directives: ConstDirectiveNode[] = [];
  if (inputValue.deprecated) {
    directives.push(buildDeprecatedDirective(inputValue.deprecated));
  }

  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: buildNameNode(inputValue.name),
    type: buildFieldTypeNode(inputValue.type),
    ...(inputValue.description
      ? { description: buildStringValueNode(inputValue.description) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

function sortByName<T extends { name: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function buildBaseFieldDefinitionNode(field: BaseField): FieldDefinitionNode {
  const directives: ConstDirectiveNode[] = [];
  if (field.deprecated) {
    directives.push(buildDeprecatedDirective(field.deprecated));
  }

  return {
    kind: Kind.FIELD_DEFINITION,
    name: buildNameNode(field.name),
    type: buildFieldTypeNode(field.type),
    ...(field.description
      ? { description: buildStringValueNode(field.description) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

export function buildFieldDefinitionNode(
  field: ExtensionField,
): FieldDefinitionNode {
  const directives: ConstDirectiveNode[] = [];
  if (field.deprecated) {
    directives.push(buildDeprecatedDirective(field.deprecated));
  }

  const args = field.args?.map(buildInputValueDefinitionNode);

  return {
    kind: Kind.FIELD_DEFINITION,
    name: buildNameNode(field.name),
    ...(args && args.length > 0 ? { arguments: args } : {}),
    type: buildFieldTypeNode(field.type),
    ...(field.description
      ? { description: buildStringValueNode(field.description) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

export function buildObjectTypeDefinitionNode(
  baseType: BaseType,
): ObjectTypeDefinitionNode {
  const sortedFields = baseType.fields ? sortByName(baseType.fields) : [];
  const directives: ConstDirectiveNode[] = [];
  if (baseType.deprecated) {
    directives.push(buildDeprecatedDirective(baseType.deprecated));
  }

  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    fields: sortedFields.map(buildBaseFieldDefinitionNode),
    ...(baseType.description
      ? { description: buildStringValueNode(baseType.description) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
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
    ...(baseType.description
      ? { description: buildStringValueNode(baseType.description) }
      : {}),
  };
}

export function buildEnumValueDefinitionNode(
  value: EnumValueInfo,
): EnumValueDefinitionNode {
  const directives: ConstDirectiveNode[] = [];
  if (value.deprecated) {
    directives.push(buildDeprecatedDirective(value.deprecated));
  }

  return {
    kind: Kind.ENUM_VALUE_DEFINITION,
    name: buildNameNode(value.name),
    ...(value.description
      ? { description: buildStringValueNode(value.description) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

export function buildEnumTypeDefinitionNode(
  baseType: BaseType,
): EnumTypeDefinitionNode {
  const enumValues = baseType.enumValues ?? [];

  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    values: enumValues.map(buildEnumValueDefinitionNode),
    ...(baseType.description
      ? { description: buildStringValueNode(baseType.description) }
      : {}),
  };
}

export function buildScalarTypeDefinitionNode(
  name: string,
  description?: string,
): ScalarTypeDefinitionNode {
  return {
    kind: Kind.SCALAR_TYPE_DEFINITION,
    name: buildNameNode(name),
    ...(description ? { description: buildStringValueNode(description) } : {}),
  };
}

function buildInputFieldDefinitionNode(
  field: BaseField,
): InputValueDefinitionNode {
  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: buildNameNode(field.name),
    type: buildFieldTypeNode(field.type),
    ...(field.description
      ? { description: buildStringValueNode(field.description) }
      : {}),
  };
}

export function buildInputObjectTypeDefinitionNode(
  inputType: InputType,
): InputObjectTypeDefinitionNode {
  const sortedFields = sortByName(inputType.fields);

  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: buildNameNode(inputType.name),
    fields: sortedFields.map(buildInputFieldDefinitionNode),
    ...(inputType.description
      ? { description: buildStringValueNode(inputType.description) }
      : {}),
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

  if (integratedResult.customScalarNames) {
    const sortedScalarNames = [...integratedResult.customScalarNames].sort(
      (a, b) => a.localeCompare(b),
    );
    for (const scalarName of sortedScalarNames) {
      definitions.push(buildScalarTypeDefinitionNode(scalarName));
    }
  }

  const sortedBaseTypes = [...integratedResult.baseTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const baseType of sortedBaseTypes) {
    if (baseType.kind === "Object") {
      definitions.push(buildObjectTypeDefinitionNode(baseType));
    } else if (baseType.kind === "Union") {
      definitions.push(buildUnionTypeDefinitionNode(baseType));
    } else if (baseType.kind === "Enum") {
      definitions.push(buildEnumTypeDefinitionNode(baseType));
    }
  }

  const sortedInputTypes = [...integratedResult.inputTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const inputType of sortedInputTypes) {
    definitions.push(buildInputObjectTypeDefinitionNode(inputType));
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
