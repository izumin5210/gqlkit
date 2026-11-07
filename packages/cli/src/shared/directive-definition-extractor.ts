/**
 * Directive definition extractor.
 *
 * This module provides functions to extract directive definitions from
 * TypeScript type aliases that use the Directive<Name, Args, Location> type.
 */

import {
  getCombinedModifierFlags,
  ModifierFlags,
  type SourceFile,
  type TypeAliasDeclaration,
} from "typescript/ast";
import { isTypeAliasDeclaration } from "typescript/ast/is";
import {
  type Program,
  type Type,
  TypeFlags,
  type TypeReference,
} from "typescript/async";
import { type GraphQLFieldType, METADATA_PROPERTIES } from "../core/index.js";
import type { CheckerLoader } from "./checker-loader.js";
import { getActualMetadataType } from "./metadata-detector.js";
import {
  getNonNullableTypes,
  isNullableUnion,
  isNullOrUndefined,
} from "./typescript-utils.js";

const DIRECTIVE_NAME_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_NAME;
const DIRECTIVE_ARGS_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_ARGS;
const DIRECTIVE_LOCATION_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_LOCATION;

/**
 * Represents a directive location.
 */
export type DirectiveLocation =
  | "SCHEMA"
  | "SCALAR"
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION"
  | "INTERFACE"
  | "UNION"
  | "ENUM"
  | "ENUM_VALUE"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION";

/**
 * Represents a directive argument definition.
 */
export interface DirectiveArgumentDefinition {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
}

/**
 * Represents a directive definition extracted from a type alias.
 */
export interface DirectiveDefinitionInfo {
  readonly name: string;
  readonly typeAliasName: string;
  readonly args: ReadonlyArray<DirectiveArgumentDefinition>;
  readonly locations: ReadonlyArray<DirectiveLocation>;
  readonly sourceFile: string;
  readonly line: number;
  readonly description: string | null;
}

/**
 * Error codes for directive definition extraction.
 */
export type DirectiveDefinitionErrorCode =
  | "UNRESOLVABLE_ARG_TYPE"
  | "INVALID_LOCATION";

/**
 * Error information for directive definition extraction.
 */
export interface DirectiveDefinitionError {
  readonly code: DirectiveDefinitionErrorCode;
  readonly message: string;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * Result of directive definition extraction.
 */
export interface DirectiveDefinitionExtractionResult {
  readonly definitions: ReadonlyArray<DirectiveDefinitionInfo>;
  readonly errors: ReadonlyArray<DirectiveDefinitionError>;
}

/**
 * Checks if a type is a Directive type (has $directiveName, $directiveArgs, $directiveLocation properties).
 */
async function isDirectiveType(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  const nameProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_NAME_PROPERTY,
  );
  const argsProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_ARGS_PROPERTY,
  );

  return nameProp !== undefined && argsProp !== undefined;
}

/**
 * Extracts the directive name from a Directive type.
 */
async function extractDirectiveName(
  type: Type,
  checker: CheckerLoader,
): Promise<string | null> {
  const nameProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_NAME_PROPERTY,
  );
  if (!nameProp) {
    return null;
  }

  const rawNameType = await checker.getTypeOfSymbol(nameProp);
  const nameType = await getActualMetadataType(rawNameType, checker);
  if (!nameType?.isStringLiteralType()) {
    return null;
  }

  return nameType.value;
}

/**
 * Extracts directive locations from a Directive type.
 */
async function extractDirectiveLocations(
  type: Type,
  checker: CheckerLoader,
): Promise<DirectiveLocation[]> {
  const locationProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_LOCATION_PROPERTY,
  );
  if (!locationProp) {
    return ["FIELD_DEFINITION"];
  }

  const rawLocationType = await checker.getTypeOfSymbol(locationProp);
  const locations: DirectiveLocation[] = [];

  // Handle tuple types like ["FIELD_DEFINITION", "OBJECT"]
  if (await checker.isTupleType(rawLocationType)) {
    const typeArgs = await checker.getTypeArguments(
      rawLocationType as TypeReference,
    );
    for (const arg of typeArgs) {
      if (arg.flags & TypeFlags.Undefined) {
        continue;
      }
      if (arg.isStringLiteralType()) {
        const value = arg.value as DirectiveLocation;
        if (isValidLocation(value)) {
          locations.push(value);
        }
      }
    }
    if (locations.length > 0) {
      return locations;
    }
  }

  // Handle array types
  if (await checker.isArrayType(rawLocationType)) {
    const typeArgs = await checker.getTypeArguments(
      rawLocationType as TypeReference,
    );
    if (typeArgs.length > 0 && typeArgs[0]) {
      const elemType = typeArgs[0];
      if (elemType.isUnionType()) {
        for (const member of await checker.getTypesOfType(elemType)) {
          if (member.flags & TypeFlags.Undefined) {
            continue;
          }
          if (member.isStringLiteralType()) {
            const value = member.value as DirectiveLocation;
            if (isValidLocation(value)) {
              locations.push(value);
            }
          }
        }
        if (locations.length > 0) {
          return locations;
        }
      }
    }
  }

  // Handle union types like "OBJECT" | "FIELD_DEFINITION" | undefined
  if (rawLocationType.isUnionType()) {
    for (const member of await checker.getTypesOfType(rawLocationType)) {
      if (member.flags & TypeFlags.Undefined) {
        continue;
      }
      if (member.isStringLiteralType()) {
        const value = member.value as DirectiveLocation;
        if (isValidLocation(value)) {
          locations.push(value);
        }
      }
    }
  } else if (rawLocationType.isStringLiteralType()) {
    const value = rawLocationType.value as DirectiveLocation;
    if (isValidLocation(value)) {
      locations.push(value);
    }
  } else {
    // Try to unwrap optional type (T | undefined where T is a single type)
    const locationType = await getActualMetadataType(rawLocationType, checker);
    if (locationType?.isStringLiteralType()) {
      const value = locationType.value as DirectiveLocation;
      if (isValidLocation(value)) {
        locations.push(value);
      }
    }
  }

  return locations.length > 0 ? locations : ["FIELD_DEFINITION"];
}

const VALID_LOCATIONS = new Set<string>([
  "SCHEMA",
  "SCALAR",
  "OBJECT",
  "FIELD_DEFINITION",
  "ARGUMENT_DEFINITION",
  "INTERFACE",
  "UNION",
  "ENUM",
  "ENUM_VALUE",
  "INPUT_OBJECT",
  "INPUT_FIELD_DEFINITION",
]);

function isValidLocation(value: string): value is DirectiveLocation {
  return VALID_LOCATIONS.has(value);
}

/**
 * Converts a TypeScript type to a GraphQL field type.
 */
async function convertToGraphQLType(
  type: Type,
  checker: CheckerLoader,
): Promise<GraphQLFieldType | null> {
  // Handle type parameters by getting their constraint
  if (type.flags & TypeFlags.TypeParameter) {
    const constraint = await checker.getBaseConstraintOfType(type);
    if (constraint) {
      return convertToGraphQLType(constraint, checker);
    }
  }

  // Check for type alias (e.g., Role = "USER" | "ADMIN")
  const aliasSymbol = await checker.getAliasSymbolOfType(type);
  if (aliasSymbol) {
    const aliasName = aliasSymbol.name;
    if (aliasName && aliasName !== "__type") {
      return {
        typeName: aliasName,
        nullable: false,
        list: false,
        listItemNullable: null,
      };
    }
  }

  if (type.flags & TypeFlags.String || type.flags & TypeFlags.StringLiteral) {
    return {
      typeName: "String",
      nullable: false,
      list: false,
      listItemNullable: null,
    };
  }

  if (type.flags & TypeFlags.Number || type.flags & TypeFlags.NumberLiteral) {
    return {
      typeName: "Float",
      nullable: false,
      list: false,
      listItemNullable: null,
    };
  }

  if (type.flags & TypeFlags.Boolean || type.flags & TypeFlags.BooleanLiteral) {
    return {
      typeName: "Boolean",
      nullable: false,
      list: false,
      listItemNullable: null,
    };
  }

  if (type.isUnionType()) {
    const nonNullTypes = await getNonNullableTypes(type, checker);
    const nullable = await isNullableUnion(type, checker);

    if (nonNullTypes.length === 1 && nonNullTypes[0]) {
      const innerType = await convertToGraphQLType(nonNullTypes[0], checker);
      if (innerType) {
        return { ...innerType, nullable };
      }
    }

    if (
      nonNullTypes.length > 0 &&
      nonNullTypes.every((t) => t.isStringLiteralType())
    ) {
      return {
        typeName: "String",
        nullable,
        list: false,
        listItemNullable: null,
      };
    }
  }

  if ((await checker.isArrayType(type)) || (await checker.isTupleType(type))) {
    const typeArgs = await checker.getTypeArguments(type as TypeReference);
    if (typeArgs.length > 0 && typeArgs[0]) {
      let elementType = typeArgs[0];

      if ((await checker.isTupleType(type)) && typeArgs.length > 1) {
        const nonNullTypes = typeArgs.filter((t) => !isNullOrUndefined(t));
        if (nonNullTypes.length > 0 && nonNullTypes[0]) {
          elementType = nonNullTypes[0];
        }
      }

      // Check if element type is a type alias (e.g., Role = "USER" | "ADMIN")
      const elementTypeAliasSymbol =
        await checker.getAliasSymbolOfType(elementType);
      if (elementTypeAliasSymbol) {
        const aliasName = elementTypeAliasSymbol.name;
        if (aliasName && aliasName !== "__type") {
          return {
            typeName: aliasName,
            nullable: false,
            list: true,
            listItemNullable: false,
          };
        }
      }

      if (elementType.isUnionType()) {
        const nonNullMembers = await getNonNullableTypes(elementType, checker);
        if (
          nonNullMembers.length > 0 &&
          nonNullMembers.every((t) => t.isStringLiteralType())
        ) {
          return {
            typeName: "String",
            nullable: false,
            list: true,
            listItemNullable: false,
          };
        }

        const hasNull = await isNullableUnion(elementType, checker);

        if (nonNullMembers.length === 1 && nonNullMembers[0]) {
          const innerType = await convertToGraphQLType(
            nonNullMembers[0],
            checker,
          );
          if (innerType && !innerType.list) {
            return {
              typeName: innerType.typeName,
              nullable: false,
              list: true,
              listItemNullable: hasNull,
            };
          }
        }
      }

      const innerType = await convertToGraphQLType(elementType, checker);
      if (innerType && !innerType.list) {
        return {
          typeName: innerType.typeName,
          nullable: false,
          list: true,
          listItemNullable: innerType.nullable,
        };
      }
    }

    return {
      typeName: "String",
      nullable: false,
      list: true,
      listItemNullable: false,
    };
  }

  const symbol = await checker.getSymbolOfType(type);
  if (symbol) {
    const symbolName = symbol.name;
    if (symbolName !== "__type" && symbolName !== "") {
      return {
        typeName: symbolName,
        nullable: false,
        list: false,
        listItemNullable: null,
      };
    }
  }

  return null;
}

/**
 * Extracts directive argument definitions from a Directive type.
 */
async function extractDirectiveArgs(
  type: Type,
  checker: CheckerLoader,
  sourceFile: string,
  line: number,
): Promise<{
  args: DirectiveArgumentDefinition[];
  errors: DirectiveDefinitionError[];
}> {
  const argsProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_ARGS_PROPERTY,
  );
  if (!argsProp) {
    return { args: [], errors: [] };
  }

  const rawArgsType = await checker.getTypeOfSymbol(argsProp);
  let argsType = await getActualMetadataType(rawArgsType, checker);
  if (!argsType) {
    return { args: [], errors: [] };
  }

  // If argsType is a type parameter, get its constraint
  if (argsType.flags & TypeFlags.TypeParameter) {
    const constraint = await checker.getBaseConstraintOfType(argsType);
    if (constraint) {
      argsType = constraint;
    }
  }

  const args: DirectiveArgumentDefinition[] = [];
  const errors: DirectiveDefinitionError[] = [];

  const properties = await checker.getPropertiesOfType(argsType);
  for (const prop of properties) {
    const propName = prop.name;
    const propType = await checker.getTypeOfSymbol(prop);

    const graphqlType = await convertToGraphQLType(propType, checker);
    if (graphqlType) {
      args.push({
        name: propName,
        type: graphqlType,
        description: null,
      });
    } else {
      errors.push({
        code: "UNRESOLVABLE_ARG_TYPE",
        message: `Cannot resolve argument type for '${propName}'`,
        sourceFile,
        line,
      });
    }
  }

  return { args, errors };
}

/**
 * Extracts directive definitions from a TypeScript program.
 *
 * This function analyzes exported type aliases to find those that use
 * the Directive<Name, Args, Location> type and extracts directive definitions.
 *
 * @param program - The TypeScript program
 * @param sourceFiles - The source files to analyze
 * @returns Extraction result with definitions and errors
 */
export interface ExtractDirectiveDefinitionsParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
}

interface ExtractDirectiveDefinitionParams {
  readonly node: TypeAliasDeclaration;
  readonly sourceFile: SourceFile;
  readonly filePath: string;
  readonly checker: CheckerLoader;
}

interface DirectiveDefinitionResult {
  readonly definition: DirectiveDefinitionInfo;
  readonly errors: ReadonlyArray<DirectiveDefinitionError>;
}

/** Returns null when the type alias is not a directive definition. */
async function extractDirectiveDefinition(
  params: ExtractDirectiveDefinitionParams,
): Promise<DirectiveDefinitionResult | null> {
  const { node, sourceFile, filePath, checker } = params;

  const symbol = await checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return null;
  }

  const type = await checker.getDeclaredTypeOfSymbol(symbol);
  if (!(await isDirectiveType(type, checker))) {
    return null;
  }

  const directiveName = await extractDirectiveName(type, checker);
  if (!directiveName) {
    return null;
  }

  const typeAliasName = node.name.getText(sourceFile);

  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  const locations = await extractDirectiveLocations(type, checker);
  const argsResult = await extractDirectiveArgs(
    type,
    checker,
    filePath,
    line + 1,
  );

  const description = await extractDescription(node, checker);

  return {
    definition: {
      name: directiveName,
      typeAliasName,
      args: argsResult.args,
      locations,
      sourceFile: filePath,
      line: line + 1,
      description,
    },
    errors: argsResult.errors,
  };
}

export async function extractDirectiveDefinitions(
  params: ExtractDirectiveDefinitionsParams,
): Promise<DirectiveDefinitionExtractionResult> {
  const { program, checker, sourceFiles } = params;

  // Each type alias is examined independently, so all of them run
  // concurrently and their checker queries batch; results keep source order.
  const resultsByFile = await Promise.all(
    sourceFiles.map(async (filePath) => {
      const sourceFile = await program.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }
      const typeAliases = sourceFile.statements.filter(
        (node): node is TypeAliasDeclaration =>
          isTypeAliasDeclaration(node) &&
          (getCombinedModifierFlags(node) & ModifierFlags.Export) !== 0,
      );
      return Promise.all(
        typeAliases.map((node) =>
          extractDirectiveDefinition({ node, sourceFile, filePath, checker }),
        ),
      );
    }),
  );

  const definitions: DirectiveDefinitionInfo[] = [];
  const errors: DirectiveDefinitionError[] = [];
  for (const result of resultsByFile.flat()) {
    if (result) {
      definitions.push(result.definition);
      errors.push(...result.errors);
    }
  }

  return { definitions, errors };
}

/**
 * Extracts description from TSDoc comments.
 */
async function extractDescription(
  node: TypeAliasDeclaration,
  checker: CheckerLoader,
): Promise<string | null> {
  const symbol = await checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return null;
  }

  const documentation = await checker.getDocumentationComment(symbol);
  if (documentation.length === 0) {
    return null;
  }

  return documentation;
}
