/**
 * Directive definition extractor.
 *
 * This module provides functions to extract directive definitions from
 * TypeScript type aliases that use the Directive<Name, Args, Location> type.
 */

import ts from "typescript";
import type { GraphQLFieldType } from "../type-extractor/types/graphql.js";
import { getActualMetadataType } from "./metadata-detector.js";

const DIRECTIVE_NAME_PROPERTY = " $directiveName";
const DIRECTIVE_ARGS_PROPERTY = " $directiveArgs";
const DIRECTIVE_LOCATION_PROPERTY = " $directiveLocation";

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
function isDirectiveType(type: ts.Type): boolean {
  const nameProp = type.getProperty(DIRECTIVE_NAME_PROPERTY);
  const argsProp = type.getProperty(DIRECTIVE_ARGS_PROPERTY);

  return nameProp !== undefined && argsProp !== undefined;
}

/**
 * Extracts the directive name from a Directive type.
 */
function extractDirectiveName(
  type: ts.Type,
  checker: ts.TypeChecker,
): string | null {
  const nameProp = type.getProperty(DIRECTIVE_NAME_PROPERTY);
  if (!nameProp) {
    return null;
  }

  const rawNameType = checker.getTypeOfSymbol(nameProp);
  const nameType = getActualMetadataType(rawNameType);
  if (!nameType || !nameType.isStringLiteral()) {
    return null;
  }

  return nameType.value;
}

/**
 * Extracts directive locations from a Directive type.
 */
function extractDirectiveLocations(
  type: ts.Type,
  checker: ts.TypeChecker,
): DirectiveLocation[] {
  const locationProp = type.getProperty(DIRECTIVE_LOCATION_PROPERTY);
  if (!locationProp) {
    return ["FIELD_DEFINITION"];
  }

  const rawLocationType = checker.getTypeOfSymbol(locationProp);
  const locations: DirectiveLocation[] = [];

  if (rawLocationType.isUnion()) {
    // Handle union types like "OBJECT" | "FIELD_DEFINITION" | undefined
    for (const member of rawLocationType.types) {
      // Skip undefined members
      if (member.flags & ts.TypeFlags.Undefined) {
        continue;
      }
      if (member.isStringLiteral()) {
        const value = member.value as DirectiveLocation;
        if (isValidLocation(value)) {
          locations.push(value);
        }
      }
    }
  } else if (rawLocationType.isStringLiteral()) {
    const value = rawLocationType.value as DirectiveLocation;
    if (isValidLocation(value)) {
      locations.push(value);
    }
  } else {
    // Try to unwrap optional type (T | undefined where T is a single type)
    const locationType = getActualMetadataType(rawLocationType);
    if (locationType?.isStringLiteral()) {
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
function convertToGraphQLType(
  type: ts.Type,
  checker: ts.TypeChecker,
): GraphQLFieldType | null {
  // Handle type parameters by getting their constraint
  if (type.flags & ts.TypeFlags.TypeParameter) {
    const constraint = checker.getBaseConstraintOfType(type);
    if (constraint) {
      return convertToGraphQLType(constraint, checker);
    }
  }

  // Check for type alias (e.g., Role = "USER" | "ADMIN")
  if (type.aliasSymbol) {
    const aliasName = type.aliasSymbol.getName();
    if (aliasName && aliasName !== "__type") {
      return {
        typeName: aliasName,
        nullable: false,
        list: false,
        listItemNullable: null,
      };
    }
  }

  if (
    type.flags & ts.TypeFlags.String ||
    type.flags & ts.TypeFlags.StringLiteral
  ) {
    return {
      typeName: "String",
      nullable: false,
      list: false,
      listItemNullable: null,
    };
  }

  if (
    type.flags & ts.TypeFlags.Number ||
    type.flags & ts.TypeFlags.NumberLiteral
  ) {
    return {
      typeName: "Float",
      nullable: false,
      list: false,
      listItemNullable: null,
    };
  }

  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return {
      typeName: "Boolean",
      nullable: false,
      list: false,
      listItemNullable: null,
    };
  }

  if (type.isUnion()) {
    const nonNullTypes = type.types.filter(
      (t) =>
        !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
    );
    const hasNull = type.types.some((t) => t.flags & ts.TypeFlags.Null);
    const hasUndefined = type.types.some(
      (t) => t.flags & ts.TypeFlags.Undefined,
    );
    const nullable = hasNull || hasUndefined;

    if (nonNullTypes.length === 1 && nonNullTypes[0]) {
      const innerType = convertToGraphQLType(nonNullTypes[0], checker);
      if (innerType) {
        return { ...innerType, nullable };
      }
    }

    if (
      nonNullTypes.length > 0 &&
      nonNullTypes.every((t) => t.isStringLiteral())
    ) {
      return {
        typeName: "String",
        nullable,
        list: false,
        listItemNullable: null,
      };
    }
  }

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs.length > 0 && typeArgs[0]) {
      let elementType = typeArgs[0];

      if (checker.isTupleType(type) && typeArgs.length > 1) {
        const nonNullTypes = typeArgs.filter(
          (t) =>
            !(t.flags & ts.TypeFlags.Null) &&
            !(t.flags & ts.TypeFlags.Undefined),
        );
        if (nonNullTypes.length > 0 && nonNullTypes[0]) {
          elementType = nonNullTypes[0];
        }
      }

      // Check if element type is a type alias (e.g., Role = "USER" | "ADMIN")
      if (elementType.aliasSymbol) {
        const aliasName = elementType.aliasSymbol.getName();
        if (aliasName && aliasName !== "__type") {
          return {
            typeName: aliasName,
            nullable: false,
            list: true,
            listItemNullable: false,
          };
        }
      }

      if (elementType.isUnion()) {
        const nonNullMembers = elementType.types.filter(
          (t) =>
            !(t.flags & ts.TypeFlags.Null) &&
            !(t.flags & ts.TypeFlags.Undefined),
        );
        if (
          nonNullMembers.length > 0 &&
          nonNullMembers.every((t) => t.isStringLiteral())
        ) {
          return {
            typeName: "String",
            nullable: false,
            list: true,
            listItemNullable: false,
          };
        }

        const hasNull = elementType.types.some(
          (t) => t.flags & ts.TypeFlags.Null,
        );

        if (nonNullMembers.length === 1 && nonNullMembers[0]) {
          const innerType = convertToGraphQLType(nonNullMembers[0], checker);
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

      const innerType = convertToGraphQLType(elementType, checker);
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

  if (type.symbol) {
    const symbolName = type.symbol.getName();
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
function extractDirectiveArgs(
  type: ts.Type,
  checker: ts.TypeChecker,
  sourceFile: string,
  line: number,
): {
  args: DirectiveArgumentDefinition[];
  errors: DirectiveDefinitionError[];
} {
  const argsProp = type.getProperty(DIRECTIVE_ARGS_PROPERTY);
  if (!argsProp) {
    return { args: [], errors: [] };
  }

  const rawArgsType = checker.getTypeOfSymbol(argsProp);
  let argsType = getActualMetadataType(rawArgsType);
  if (!argsType) {
    return { args: [], errors: [] };
  }

  // If argsType is a type parameter, get its constraint
  if (argsType.flags & ts.TypeFlags.TypeParameter) {
    const constraint = checker.getBaseConstraintOfType(argsType);
    if (constraint) {
      argsType = constraint;
    }
  }

  const args: DirectiveArgumentDefinition[] = [];
  const errors: DirectiveDefinitionError[] = [];

  const properties = argsType.getProperties();
  for (const prop of properties) {
    const propName = prop.getName();
    const propType = checker.getTypeOfSymbol(prop);

    const graphqlType = convertToGraphQLType(propType, checker);
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
export function extractDirectiveDefinitions(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
): DirectiveDefinitionExtractionResult {
  const checker = program.getTypeChecker();
  const definitions: DirectiveDefinitionInfo[] = [];
  const errors: DirectiveDefinitionError[] = [];

  for (const filePath of sourceFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      continue;
    }

    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isTypeAliasDeclaration(node)) {
        return;
      }

      const modifiers = ts.getCombinedModifierFlags(node);
      const isExported = (modifiers & ts.ModifierFlags.Export) !== 0;
      if (!isExported) {
        return;
      }

      const symbol = checker.getSymbolAtLocation(node.name);
      if (!symbol) {
        return;
      }

      const type = checker.getDeclaredTypeOfSymbol(symbol);
      if (!isDirectiveType(type)) {
        return;
      }

      const directiveName = extractDirectiveName(type, checker);
      if (!directiveName) {
        return;
      }

      const typeAliasName = node.name.getText(sourceFile);

      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );

      const locations = extractDirectiveLocations(type, checker);
      const argsResult = extractDirectiveArgs(
        type,
        checker,
        filePath,
        line + 1,
      );

      const description = extractDescription(node, checker);

      definitions.push({
        name: directiveName,
        typeAliasName,
        args: argsResult.args,
        locations,
        sourceFile: filePath,
        line: line + 1,
        description,
      });

      errors.push(...argsResult.errors);
    });
  }

  return { definitions, errors };
}

/**
 * Extracts description from TSDoc comments.
 */
function extractDescription(
  node: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker,
): string | null {
  const symbol = checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return null;
  }

  const documentation = symbol.getDocumentationComment(checker);
  if (documentation.length === 0) {
    return null;
  }

  return documentation.map((d) => d.text).join("\n");
}
