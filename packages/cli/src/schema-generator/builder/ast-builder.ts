import path from "node:path";
import {
  type ConstArgumentNode,
  type ConstDirectiveNode,
  type ConstValueNode,
  type DefinitionNode,
  type DirectiveDefinitionNode,
  type DocumentNode,
  type EnumTypeDefinitionNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type InputObjectTypeDefinitionNode,
  type InputValueDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type InterfaceTypeExtensionNode,
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
import type { DirectiveDefinitionInfo } from "../../shared/directive-definition-extractor.js";
import type {
  DirectiveArgument,
  DirectiveArgumentValue,
  DirectiveInfo,
} from "../../shared/directive-detector.js";
import { toPosixPath } from "../../shared/index.js";
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

export interface BuildDocumentOptions {
  readonly sourceRoot?: string;
}

function appendSourceLocation(
  description: string | null,
  sourceFile: string | null,
  sourceRoot: string | undefined,
): string | null {
  if (!sourceRoot || !sourceFile) {
    return description;
  }

  const relativePath = toPosixPath(path.relative(sourceRoot, sourceFile));
  const sourceLocation = `Defined in: ${relativePath}`;

  if (description) {
    return `${description}\n\n${sourceLocation}`;
  }
  return sourceLocation;
}

function buildNameNode(value: string): NameNode {
  return {
    kind: Kind.NAME,
    value,
  };
}

function buildStringValueNode(value: string): StringValueNode {
  return {
    kind: Kind.STRING,
    value,
    block: true,
  };
}

const DEFAULT_DEPRECATION_REASON = "No longer supported";

function buildDeprecatedDirective(
  deprecated: DeprecationInfo,
): ConstDirectiveNode {
  const reason = deprecated.reason ?? DEFAULT_DEPRECATION_REASON;

  return {
    kind: Kind.DIRECTIVE,
    name: buildNameNode("deprecated"),
    arguments: [
      {
        kind: Kind.ARGUMENT,
        name: buildNameNode("reason"),
        value: buildStringValueNode(reason),
      },
    ],
  };
}

function buildOneOfDirective(): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    name: buildNameNode("oneOf"),
  };
}

function buildDirectiveArgumentValue(
  value: DirectiveArgumentValue,
  expectedTypeName?: string,
): ConstValueNode {
  switch (value.kind) {
    case "string":
      return {
        kind: Kind.STRING,
        value: value.value,
      };
    case "number":
      return Number.isInteger(value.value)
        ? { kind: Kind.INT, value: String(value.value) }
        : { kind: Kind.FLOAT, value: String(value.value) };
    case "boolean":
      return {
        kind: Kind.BOOLEAN,
        value: value.value,
      };
    case "null":
      return {
        kind: Kind.NULL,
      };
    case "enum":
      // If the expected type is String, output as string literal with quotes
      if (expectedTypeName === "String") {
        return {
          kind: Kind.STRING,
          value: value.value,
        };
      }
      return {
        kind: Kind.ENUM,
        value: value.value,
      };
    case "list":
      return {
        kind: Kind.LIST,
        values: value.values.map((v) =>
          buildDirectiveArgumentValue(v, expectedTypeName),
        ),
      };
    case "object":
      return {
        kind: Kind.OBJECT,
        fields: value.fields.map((f) => ({
          kind: Kind.OBJECT_FIELD as const,
          name: buildNameNode(f.name),
          value: buildDirectiveArgumentValue(f.value),
        })),
      };
  }
}

function buildDirectiveArgument(
  arg: DirectiveArgument,
  expectedTypeName?: string,
): ConstArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    name: buildNameNode(arg.name),
    value: buildDirectiveArgumentValue(arg.value, expectedTypeName),
  };
}

function buildCustomDirective(
  directive: DirectiveInfo,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): ConstDirectiveNode {
  const def = directiveDefMap?.get(directive.name);
  const argTypeMap = new Map<string, string>();
  if (def) {
    for (const argDef of def.args) {
      argTypeMap.set(argDef.name, argDef.type.typeName);
    }
  }

  const args = directive.args.map((arg) =>
    buildDirectiveArgument(arg, argTypeMap.get(arg.name)),
  );

  return {
    kind: Kind.DIRECTIVE,
    name: buildNameNode(directive.name),
    ...(args.length > 0 ? { arguments: args } : {}),
  };
}

function buildDirectives(
  directives: ReadonlyArray<DirectiveInfo> | null,
  deprecated: DeprecationInfo | null,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): ConstDirectiveNode[] {
  const result: ConstDirectiveNode[] = [];

  if (deprecated) {
    result.push(buildDeprecatedDirective(deprecated));
  }

  if (directives) {
    for (const directive of directives) {
      result.push(buildCustomDirective(directive, directiveDefMap));
    }
  }

  return result;
}

function buildNamedTypeNode(typeName: string): NamedTypeNode {
  return {
    kind: Kind.NAMED_TYPE,
    name: buildNameNode(typeName),
  };
}

function buildListTypeNode(
  innerType: NamedTypeNode | NonNullTypeNode,
): ListTypeNode {
  return {
    kind: Kind.LIST_TYPE,
    type: innerType,
  };
}

function buildNonNullTypeNode(
  innerType: NamedTypeNode | ListTypeNode,
): NonNullTypeNode {
  return {
    kind: Kind.NON_NULL_TYPE,
    type: innerType,
  };
}

function buildFieldTypeNode(fieldType: GraphQLFieldType): TypeNode {
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

function buildInputValueDefinitionNode(
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
    ...(inputValue.defaultValue
      ? { defaultValue: buildDirectiveArgumentValue(inputValue.defaultValue) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

function sortByName<T extends { name: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function buildBaseFieldDefinitionNode(
  field: BaseField,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): FieldDefinitionNode {
  const directives = buildDirectives(
    field.directives,
    field.deprecated,
    directiveDefMap,
  );

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

function buildFieldDefinitionNode(
  field: ExtensionField,
  sourceRoot?: string,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): FieldDefinitionNode {
  const directives = buildDirectives(
    field.directives,
    field.deprecated,
    directiveDefMap,
  );

  const args = field.args?.map(buildInputValueDefinitionNode);

  const description = appendSourceLocation(
    field.description,
    field.resolverSourceFile,
    sourceRoot,
  );

  return {
    kind: Kind.FIELD_DEFINITION,
    name: buildNameNode(field.name),
    ...(args && args.length > 0 ? { arguments: args } : {}),
    type: buildFieldTypeNode(field.type),
    ...(description ? { description: buildStringValueNode(description) } : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

function buildObjectTypeDefinitionNode(
  baseType: BaseType,
  sourceRoot?: string,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): ObjectTypeDefinitionNode {
  const sortedFields = baseType.fields ? sortByName(baseType.fields) : [];
  const directives = buildDirectives(
    baseType.directives,
    baseType.deprecated,
    directiveDefMap,
  );

  const description = appendSourceLocation(
    baseType.description,
    baseType.sourceFile,
    sourceRoot,
  );

  const interfaces =
    baseType.implementedInterfaces && baseType.implementedInterfaces.length > 0
      ? [...baseType.implementedInterfaces]
          .sort((a, b) => a.localeCompare(b))
          .map(buildNamedTypeNode)
      : undefined;

  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    fields: sortedFields.map((f) =>
      buildBaseFieldDefinitionNode(f, directiveDefMap),
    ),
    ...(description ? { description: buildStringValueNode(description) } : {}),
    ...(directives.length > 0 ? { directives } : {}),
    ...(interfaces ? { interfaces } : {}),
  };
}

function buildInterfaceTypeDefinitionNode(
  baseType: BaseType,
  sourceRoot?: string,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): InterfaceTypeDefinitionNode {
  const sortedFields = baseType.fields ? sortByName(baseType.fields) : [];
  const directives = buildDirectives(
    baseType.directives,
    baseType.deprecated,
    directiveDefMap,
  );

  const description = appendSourceLocation(
    baseType.description,
    baseType.sourceFile,
    sourceRoot,
  );

  const interfaces =
    baseType.implementedInterfaces && baseType.implementedInterfaces.length > 0
      ? [...baseType.implementedInterfaces]
          .sort((a, b) => a.localeCompare(b))
          .map(buildNamedTypeNode)
      : undefined;

  return {
    kind: Kind.INTERFACE_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    fields: sortedFields.map((f) =>
      buildBaseFieldDefinitionNode(f, directiveDefMap),
    ),
    ...(description ? { description: buildStringValueNode(description) } : {}),
    ...(directives.length > 0 ? { directives } : {}),
    ...(interfaces ? { interfaces } : {}),
  };
}

function buildUnionTypeDefinitionNode(
  baseType: BaseType,
  sourceRoot?: string,
): UnionTypeDefinitionNode {
  const sortedMembers = baseType.unionMembers
    ? [...baseType.unionMembers].sort((a, b) => a.localeCompare(b))
    : [];

  const description = appendSourceLocation(
    baseType.description,
    baseType.sourceFile,
    sourceRoot,
  );

  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    types: sortedMembers.map(buildNamedTypeNode),
    ...(description ? { description: buildStringValueNode(description) } : {}),
  };
}

function buildEnumValueDefinitionNode(
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

function buildEnumTypeDefinitionNode(
  baseType: BaseType,
  sourceRoot?: string,
): EnumTypeDefinitionNode {
  const enumValues = baseType.enumValues ?? [];

  const description = appendSourceLocation(
    baseType.description,
    baseType.sourceFile,
    sourceRoot,
  );

  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    name: buildNameNode(baseType.name),
    values: enumValues.map(buildEnumValueDefinitionNode),
    ...(description ? { description: buildStringValueNode(description) } : {}),
  };
}

function buildScalarTypeDefinitionNode(
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
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): InputValueDefinitionNode {
  const directives = buildDirectives(
    field.directives,
    field.deprecated,
    directiveDefMap,
  );

  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: buildNameNode(field.name),
    type: buildFieldTypeNode(field.type),
    ...(field.description
      ? { description: buildStringValueNode(field.description) }
      : {}),
    ...(field.defaultValue
      ? { defaultValue: buildDirectiveArgumentValue(field.defaultValue) }
      : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

function buildInputObjectTypeDefinitionNode(
  inputType: InputType,
  sourceRoot?: string,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): InputObjectTypeDefinitionNode {
  const sortedFields = sortByName(inputType.fields);

  const description = appendSourceLocation(
    inputType.description,
    inputType.sourceFile,
    sourceRoot,
  );

  const directives: ConstDirectiveNode[] = [];
  if (inputType.isOneOf) {
    directives.push(buildOneOfDirective());
  }

  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: buildNameNode(inputType.name),
    fields: sortedFields.map((f) =>
      buildInputFieldDefinitionNode(f, directiveDefMap),
    ),
    ...(description ? { description: buildStringValueNode(description) } : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
}

function buildObjectTypeExtensionNode(
  typeExtension: TypeExtension,
  sourceRoot?: string,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): ObjectTypeExtensionNode {
  const sortedFields = sortByName(typeExtension.fields);
  return {
    kind: Kind.OBJECT_TYPE_EXTENSION,
    name: buildNameNode(typeExtension.targetTypeName),
    fields: sortedFields.map((field) =>
      buildFieldDefinitionNode(field, sourceRoot, directiveDefMap),
    ),
  };
}

function buildInterfaceTypeExtensionNode(
  typeExtension: TypeExtension,
  sourceRoot?: string,
  directiveDefMap?: Map<string, DirectiveDefinitionInfo>,
): InterfaceTypeExtensionNode {
  const sortedFields = sortByName(typeExtension.fields);
  return {
    kind: Kind.INTERFACE_TYPE_EXTENSION,
    name: buildNameNode(typeExtension.targetTypeName),
    fields: sortedFields.map((field) =>
      buildFieldDefinitionNode(field, sourceRoot, directiveDefMap),
    ),
  };
}

function buildDirectiveDefinitionNode(
  directiveDef: DirectiveDefinitionInfo,
): DirectiveDefinitionNode {
  const sortedArgs = [...directiveDef.args].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const args: InputValueDefinitionNode[] = sortedArgs.map((arg) => ({
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: buildNameNode(arg.name),
    type: buildFieldTypeNode(arg.type),
    ...(arg.description
      ? { description: buildStringValueNode(arg.description) }
      : {}),
  }));

  const sortedLocations = [...directiveDef.locations].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    kind: Kind.DIRECTIVE_DEFINITION,
    name: buildNameNode(directiveDef.name),
    repeatable: false,
    locations: sortedLocations.map(buildNameNode),
    ...(args.length > 0 ? { arguments: args } : {}),
    ...(directiveDef.description
      ? { description: buildStringValueNode(directiveDef.description) }
      : {}),
  };
}

export function buildDocumentNode(
  integratedResult: IntegratedResult,
  options?: BuildDocumentOptions,
): DocumentNode {
  const sourceRoot = options?.sourceRoot;
  const definitions: DefinitionNode[] = [];

  // Build directive definition map for argument type lookup
  const directiveDefMap = new Map<string, DirectiveDefinitionInfo>();
  if (integratedResult.directiveDefinitions) {
    for (const def of integratedResult.directiveDefinitions) {
      directiveDefMap.set(def.name, def);
    }
  }

  if (integratedResult.directiveDefinitions) {
    const sortedDirectives = [...integratedResult.directiveDefinitions].sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    for (const directiveDef of sortedDirectives) {
      definitions.push(buildDirectiveDefinitionNode(directiveDef));
    }
  }

  if (integratedResult.customScalars) {
    const sortedScalars = [...integratedResult.customScalars].sort((a, b) =>
      a.scalarName.localeCompare(b.scalarName),
    );
    for (const scalar of sortedScalars) {
      definitions.push(
        buildScalarTypeDefinitionNode(
          scalar.scalarName,
          scalar.description ?? undefined,
        ),
      );
    }
  } else if (integratedResult.customScalarNames) {
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
    if (baseType.kind === "Interface") {
      definitions.push(
        buildInterfaceTypeDefinitionNode(baseType, sourceRoot, directiveDefMap),
      );
    } else if (baseType.kind === "Object") {
      definitions.push(
        buildObjectTypeDefinitionNode(baseType, sourceRoot, directiveDefMap),
      );
    } else if (baseType.kind === "Union") {
      definitions.push(buildUnionTypeDefinitionNode(baseType, sourceRoot));
    } else if (baseType.kind === "Enum") {
      definitions.push(buildEnumTypeDefinitionNode(baseType, sourceRoot));
    }
  }

  const sortedInputTypes = [...integratedResult.inputTypes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const inputType of sortedInputTypes) {
    definitions.push(
      buildInputObjectTypeDefinitionNode(
        inputType,
        sourceRoot,
        directiveDefMap,
      ),
    );
  }

  const interfaceTypeNames = new Set(
    integratedResult.baseTypes
      .filter((t) => t.kind === "Interface")
      .map((t) => t.name),
  );

  const sortedExtensions = [...integratedResult.typeExtensions].sort((a, b) =>
    a.targetTypeName.localeCompare(b.targetTypeName),
  );

  for (const ext of sortedExtensions) {
    if (interfaceTypeNames.has(ext.targetTypeName)) {
      definitions.push(
        buildInterfaceTypeExtensionNode(ext, sourceRoot, directiveDefMap),
      );
    } else {
      definitions.push(
        buildObjectTypeExtensionNode(ext, sourceRoot, directiveDefMap),
      );
    }
  }

  return {
    kind: Kind.DOCUMENT,
    definitions,
  };
}
