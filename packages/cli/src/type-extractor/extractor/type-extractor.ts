import ts from "typescript";
import {
  type DirectiveInfo,
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import {
  extractImplementsFromDefineInterface,
  extractImplementsFromGqlTypeDef,
  isDefineInterfaceTypeAlias,
} from "../../shared/interface-detector.js";
import { detectScalarMetadata } from "../../shared/metadata-detector.js";
import {
  extractTSDocFromSymbol,
  extractTSDocInfo,
} from "../../shared/tsdoc-parser.js";
import type { ScalarMetadataInfo } from "../collector/scalar-collector.js";
import type {
  Diagnostic,
  EnumMemberInfo,
  ExtractedTypeInfo,
  FieldDefinition,
  InlineObjectMember,
  InlineObjectProperty,
  TSTypeReference,
  TypeKind,
  TypeMetadata,
} from "../types/index.js";

/**
 * Global type mapping configuration.
 * Maps TypeScript type names to GraphQL scalar names when tsType.from is omitted.
 */
export interface GlobalTypeMapping {
  /** TypeScript type name (e.g., "Date", "URL") */
  readonly typeName: string;
  /** GraphQL scalar name (e.g., "DateTime", "URL") */
  readonly scalarName: string;
  /** Usage constraint */
  readonly only: "input" | "output" | null;
}

export interface ExtractionOptions {
  /** Global type mappings from config (scalars with tsType.from omitted) */
  readonly globalTypeMappings?: ReadonlyArray<GlobalTypeMapping>;
}

export interface ExtractionResult {
  readonly types: ReadonlyArray<ExtractedTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly detectedScalarNames: ReadonlyArray<string>;
  readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (modifiers & ts.ModifierFlags.Export) !== 0;
}

function isDefaultExport(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let hasDefaultExport = false;
  const nodeName = (node as ts.DeclarationStatement).name?.getText(sourceFile);

  ts.forEachChild(sourceFile, (child) => {
    if (
      ts.isExportAssignment(child) &&
      !child.isExportEquals &&
      ts.isIdentifier(child.expression)
    ) {
      if (child.expression.text === nodeName) {
        hasDefaultExport = true;
      }
    }
  });

  return hasDefaultExport;
}

function isBooleanUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;
  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );
  return (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
  );
}

interface TypeReferenceResult {
  readonly tsType: TSTypeReference;
}

function findGlobalTypeMapping(
  typeName: string,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping>,
): GlobalTypeMapping | undefined {
  return globalTypeMappings.find((m) => m.typeName === typeName);
}

function convertTsTypeToReferenceWithBrandInfo(
  type: ts.Type,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping> = [],
): TypeReferenceResult {
  const metadataResult = detectScalarMetadata(type, checker);
  if (metadataResult.scalarName && !metadataResult.isPrimitive) {
    return {
      tsType: {
        kind: "scalar",
        name: metadataResult.scalarName,
        elementType: null,
        members: null,
        nullable: metadataResult.nullable,
        scalarInfo: {
          scalarName: metadataResult.scalarName,
          typeName: metadataResult.scalarName,
          baseType: undefined,
          isCustom: true,
          only: metadataResult.only,
        },
      },
    };
  }

  if (isBooleanUnion(type)) {
    const hasNull =
      type.isUnion() && type.types.some((t) => t.flags & ts.TypeFlags.Null);
    const hasUndefined =
      type.isUnion() &&
      type.types.some((t) => t.flags & ts.TypeFlags.Undefined);
    return {
      tsType: {
        kind: "primitive",
        name: "boolean",
        elementType: null,
        members: null,
        nullable: hasNull || hasUndefined,
        scalarInfo: null,
      },
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

    if (nonNullTypes.length === 1) {
      const innerResult = convertTsTypeToReferenceWithBrandInfo(
        nonNullTypes[0]!,
        checker,
        globalTypeMappings,
      );
      return {
        tsType: { ...innerResult.tsType, nullable },
      };
    }

    const memberResults = nonNullTypes.map((t) =>
      convertTsTypeToReferenceWithBrandInfo(t, checker, globalTypeMappings),
    );

    return {
      tsType: {
        kind: "union",
        name: null,
        elementType: null,
        members: memberResults.map((r) => r.tsType),
        nullable,
        scalarInfo: null,
      },
    };
  }

  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const elementType = typeArgs?.[0];
    const elementResult = elementType
      ? convertTsTypeToReferenceWithBrandInfo(
          elementType,
          checker,
          globalTypeMappings,
        )
      : {
          tsType: {
            kind: "primitive" as const,
            name: "unknown",
            elementType: null,
            members: null,
            nullable: false,
            scalarInfo: null,
          },
        };

    return {
      tsType: {
        kind: "array",
        name: null,
        elementType: elementResult.tsType,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }

  const typeString = checker.typeToString(type);

  if (type.flags & ts.TypeFlags.String) {
    return {
      tsType: {
        kind: "primitive",
        name: "string",
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return {
      tsType: {
        kind: "primitive",
        name: "number",
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return {
      tsType: {
        kind: "primitive",
        name: "boolean",
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return {
      tsType: {
        kind: "literal",
        name: typeString.replace(/"/g, ""),
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return {
      tsType: {
        kind: "literal",
        name: typeString,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }

  if (type.symbol) {
    const symbolName = type.symbol.getName();

    const globalMapping = findGlobalTypeMapping(symbolName, globalTypeMappings);
    if (globalMapping) {
      return {
        tsType: {
          kind: "scalar",
          name: globalMapping.scalarName,
          elementType: null,
          members: null,
          nullable: false,
          scalarInfo: {
            scalarName: globalMapping.scalarName,
            typeName: globalMapping.typeName,
            baseType: undefined,
            isCustom: true,
            only: globalMapping.only,
          },
        },
      };
    }

    return {
      tsType: {
        kind: "reference",
        name: symbolName,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
      },
    };
  }

  return {
    tsType: {
      kind: "reference",
      name: typeString,
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
    },
  };
}

function collectPropertiesFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Symbol[] {
  if (type.isIntersection()) {
    const allProps = new Map<string, ts.Symbol>();
    for (const member of type.types) {
      // getProperties() works for both named and anonymous types
      // Avoid getDeclaredTypeOfSymbol as it may return empty for anonymous types
      const memberProps = member.getProperties();
      for (const prop of memberProps) {
        const propName = prop.getName();
        if (!allProps.has(propName)) {
          allProps.set(propName, prop);
        }
      }
    }
    return [...allProps.values()];
  }

  const properties = type.getProperties();
  if (properties.length > 0) {
    return [...properties];
  }

  const apparentType = checker.getApparentType(type);
  if (apparentType !== type) {
    return [...apparentType.getProperties()];
  }

  return [];
}

function extractFieldsFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping> = [],
): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  const properties = collectPropertiesFromType(type, checker);

  for (const prop of properties) {
    const propName = prop.getName();

    if (propName.startsWith(" $")) {
      continue;
    }

    const propType = checker.getTypeOfSymbol(prop);
    const declarations = prop.getDeclarations();
    const declaration = declarations?.[0];

    let optional = false;
    if (declaration && ts.isPropertySignature(declaration)) {
      optional = declaration.questionToken !== undefined;
    }

    const tsdocInfo = extractTSDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;

    if (hasDirectiveMetadata(propType)) {
      const directiveResult = detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }
      // Check if the original type is nullable before unwrapping
      // TypeScript normalizes WithDirectives<T | null, [...]> to (T & Directive) | null
      if (propType.isUnion()) {
        const hasNull = propType.types.some((t) => t.flags & ts.TypeFlags.Null);
        const hasUndefined = propType.types.some(
          (t) => t.flags & ts.TypeFlags.Undefined,
        );
        if (hasNull || hasUndefined) {
          directiveNullable = true;
        }
      }
      actualPropType = unwrapDirectiveType(propType, checker);

      // Check if the unwrapped type (from $gqlkitOriginalType) is nullable
      // This handles cases where TypeScript normalizes intersection types
      // and loses the null from the outer union
      if (!directiveNullable && actualPropType.isUnion()) {
        const hasNull = actualPropType.types.some(
          (t) => t.flags & ts.TypeFlags.Null,
        );
        const hasUndefined = actualPropType.types.some(
          (t) => t.flags & ts.TypeFlags.Undefined,
        );
        if (hasNull || hasUndefined) {
          directiveNullable = true;
        }
      }
    }

    const typeResult = convertTsTypeToReferenceWithBrandInfo(
      actualPropType,
      checker,
      globalTypeMappings,
    );

    // Preserve nullability from original WithDirectives type
    const tsType =
      directiveNullable && !typeResult.tsType.nullable
        ? { ...typeResult.tsType, nullable: true }
        : typeResult.tsType;

    fields.push({
      name: propName,
      tsType,
      optional,
      description: tsdocInfo.description ?? null,
      deprecated: tsdocInfo.deprecated ?? null,
      directives,
    });
  }

  return fields;
}

function isNumericEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length === 0) return true;

  return members.every((member) => {
    const initializer = member.initializer;
    if (initializer === undefined) return true;
    return (
      ts.isNumericLiteral(initializer) ||
      ts.isPrefixUnaryExpression(initializer)
    );
  });
}

function isHeterogeneousEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length <= 1) return false;

  let hasString = false;
  let hasNumeric = false;

  for (const member of members) {
    const initializer = member.initializer;
    if (initializer === undefined) {
      hasNumeric = true;
    } else if (ts.isStringLiteral(initializer)) {
      hasString = true;
    } else if (
      ts.isNumericLiteral(initializer) ||
      ts.isPrefixUnaryExpression(initializer)
    ) {
      hasNumeric = true;
    }

    if (hasString && hasNumeric) return true;
  }

  return false;
}

function isConstEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const modifiers = ts.getCombinedModifierFlags(node);
  return (modifiers & ts.ModifierFlags.Const) !== 0;
}

function isStringLiteralUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );

  if (nonNullTypes.length === 0) return false;

  return nonNullTypes.every((t) => t.flags & ts.TypeFlags.StringLiteral);
}

function extractEnumMembers(
  node: ts.EnumDeclaration,
  checker: ts.TypeChecker,
): ReadonlyArray<EnumMemberInfo> {
  const members: EnumMemberInfo[] = [];

  for (const member of node.members) {
    const name = member.name.getText();
    const initializer = member.initializer;
    if (initializer && ts.isStringLiteral(initializer)) {
      const symbol = checker.getSymbolAtLocation(member.name);
      const tsdocInfo = symbol
        ? extractTSDocFromSymbol(symbol, checker)
        : { description: undefined, deprecated: undefined };

      members.push({
        name,
        value: initializer.text,
        description: tsdocInfo.description ?? null,
        deprecated: tsdocInfo.deprecated ?? null,
      });
    }
  }

  return members;
}

function extractStringLiteralUnionMembers(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlyArray<EnumMemberInfo> {
  if (!type.isUnion()) return [];

  const members: EnumMemberInfo[] = [];

  for (const t of type.types) {
    if (t.flags & ts.TypeFlags.Null || t.flags & ts.TypeFlags.Undefined) {
      continue;
    }
    if (t.flags & ts.TypeFlags.StringLiteral) {
      const value = checker.typeToString(t).replace(/^"|"$/g, "");
      members.push({
        name: value,
        value: value,
        description: null,
        deprecated: null,
      });
    }
  }

  return members;
}

function determineTypeKind(
  node: ts.Node,
  type: ts.Type,
  sourceFile: ts.SourceFile,
): TypeKind {
  if (ts.isInterfaceDeclaration(node)) {
    return "interface";
  }

  if (ts.isTypeAliasDeclaration(node)) {
    if (isDefineInterfaceTypeAlias(node, sourceFile)) {
      return "graphqlInterface";
    }

    if (type.isUnion()) {
      const nonNullTypes = type.types.filter(
        (t) =>
          !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
      );

      if (isStringLiteralUnion(type)) {
        return "enum";
      }

      const allObjectTypes = nonNullTypes.every(
        (t) =>
          (t.flags & ts.TypeFlags.Object) !== 0 ||
          (t.flags & ts.TypeFlags.Intersection) !== 0 ||
          t.symbol !== undefined,
      );
      if (nonNullTypes.length > 1 && allObjectTypes) {
        return "union";
      }
    }
    return "object";
  }

  return "object";
}

function isAnonymousObjectType(memberType: ts.Type): boolean {
  // For type aliases (including GqlTypeDef which creates intersection types),
  // use aliasSymbol to get the original type name
  if (memberType.aliasSymbol) {
    return false;
  }
  if (!memberType.symbol) return true;
  const symbolName = memberType.symbol.getName();
  return symbolName === "__type" || symbolName === "";
}

function getNamedTypeName(memberType: ts.Type): string {
  // For type aliases (e.g., GqlTypeDef<...>), use aliasSymbol
  if (memberType.aliasSymbol) {
    return memberType.aliasSymbol.getName();
  }
  // For regular types, use symbol
  return memberType.symbol?.getName() ?? "";
}

interface InlineObjectExtractionResult {
  readonly members: InlineObjectMember[];
  readonly hasInlineObjects: boolean;
  readonly hasNamedTypes: boolean;
}

function extractInlineObjectMembers(
  type: ts.Type,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping> = [],
): InlineObjectExtractionResult | null {
  if (!type.isUnion()) {
    return null;
  }

  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );

  const allObjectTypes = nonNullTypes.every(
    (t) =>
      (t.flags & ts.TypeFlags.Object) !== 0 ||
      (t.flags & ts.TypeFlags.Intersection) !== 0,
  );

  if (nonNullTypes.length < 2 || !allObjectTypes) {
    return null;
  }

  let hasInlineObjects = false;
  let hasNamedTypes = false;
  const members: InlineObjectMember[] = [];

  for (const memberType of nonNullTypes) {
    if (isAnonymousObjectType(memberType)) {
      hasInlineObjects = true;
      const properties = memberType.getProperties();
      const memberProperties: InlineObjectProperty[] = [];

      for (const prop of properties) {
        const propType = checker.getTypeOfSymbol(prop);
        const tsdocInfo = extractTSDocFromSymbol(prop, checker);
        const typeResult = convertTsTypeToReferenceWithBrandInfo(
          propType,
          checker,
          globalTypeMappings,
        );

        memberProperties.push({
          propertyName: prop.getName(),
          propertyType: typeResult.tsType,
          description: tsdocInfo.description ?? null,
          deprecated: tsdocInfo.deprecated ?? null,
        });
      }

      members.push({ properties: memberProperties });
    } else {
      hasNamedTypes = true;
    }
  }

  return { members, hasInlineObjects, hasNamedTypes };
}

function extractUnionMembers(type: ts.Type): string[] | undefined {
  if (!type.isUnion()) {
    return undefined;
  }

  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );

  const allObjectTypes = nonNullTypes.every(
    (t) =>
      (t.flags & ts.TypeFlags.Object) !== 0 ||
      (t.flags & ts.TypeFlags.Intersection) !== 0 ||
      t.symbol !== undefined,
  );

  if (nonNullTypes.length > 1 && allObjectTypes) {
    const namedMembers = nonNullTypes
      .filter((t) => !isAnonymousObjectType(t))
      .map((t) => getNamedTypeName(t))
      .filter((name) => name !== "" && name !== "__type");

    if (namedMembers.length > 0) {
      return namedMembers.sort();
    }
  }

  return undefined;
}

export function extractTypesFromProgram(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
  options: ExtractionOptions = {},
): ExtractionResult {
  const checker = program.getTypeChecker();
  const types: ExtractedTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];
  const detectedScalarNames = new Set<string>();
  const detectedScalars: ScalarMetadataInfo[] = [];
  const globalTypeMappings = options.globalTypeMappings ?? [];

  for (const filePath of sourceFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      diagnostics.push({
        code: "PARSE_ERROR",
        message: `Could not load source file: ${filePath}`,
        severity: "error",
        location: { file: filePath, line: 1, column: 1 },
      });
      continue;
    }

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isEnumDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          return;
        }

        const name = node.name.getText(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const location = {
          file: filePath,
          line: line + 1,
          column: character + 1,
        };

        if (isConstEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Const enum '${name}' is not supported. Use a regular enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        if (isHeterogeneousEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Heterogeneous enum '${name}' is not supported. Use a string enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        if (isNumericEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Numeric enum '${name}' is not supported. Use a string enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        const enumMembers = extractEnumMembers(node, checker);
        const tsdocInfo = extractTSDocInfo(node, checker);
        const metadata: TypeMetadata = {
          name,
          kind: "enum",
          sourceFile: filePath,
          exportKind: hasDefaultExport ? "default" : "named",
          description: tsdocInfo.description,
          deprecated: tsdocInfo.deprecated,
          directives: null,
        };

        types.push({
          metadata,
          fields: [],
          unionMembers: null,
          inlineObjectMembers: null,
          enumMembers,
          implementedInterfaces: null,
        });
        return;
      }

      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          return;
        }

        const name = node.name.getText(sourceFile);

        if (node.typeParameters && node.typeParameters.length > 0) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          diagnostics.push({
            code: "UNSUPPORTED_SYNTAX",
            message: `Generic type '${name}' is not supported. Consider using a concrete type instead.`,
            severity: "warning",
            location: { file: filePath, line: line + 1, column: character + 1 },
          });
        }

        const symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol) {
          return;
        }

        const type = checker.getDeclaredTypeOfSymbol(symbol);

        const scalarMetadata = detectScalarMetadata(type, checker);
        if (scalarMetadata.scalarName && !scalarMetadata.isPrimitive) {
          detectedScalarNames.add(scalarMetadata.scalarName);
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          const tsdocInfo = extractTSDocInfo(node, checker);
          detectedScalars.push({
            scalarName: scalarMetadata.scalarName,
            typeName: name,
            only: scalarMetadata.only,
            sourceFile: filePath,
            line: line + 1,
            description: tsdocInfo.description ?? null,
          });
          return;
        }

        let typeDirectives: ReadonlyArray<DirectiveInfo> | null = null;
        let actualType = type;

        if (hasDirectiveMetadata(type)) {
          const directiveResult = detectDirectiveMetadata(type, checker);
          if (directiveResult.directives.length > 0) {
            typeDirectives = directiveResult.directives;
          }
          if (directiveResult.errors.length > 0) {
            const { line: errorLine, character: errorColumn } =
              sourceFile.getLineAndCharacterOfPosition(
                node.getStart(sourceFile),
              );
            for (const error of directiveResult.errors) {
              diagnostics.push({
                code: error.code,
                message: `Type '${name}': ${error.message}`,
                severity: "error",
                location: {
                  file: filePath,
                  line: errorLine + 1,
                  column: errorColumn + 1,
                },
              });
            }
          }
          actualType = type;
        }

        const kind = determineTypeKind(node, actualType, sourceFile);
        const unionMembers = extractUnionMembers(actualType);
        const inlineObjectResult = extractInlineObjectMembers(
          actualType,
          checker,
          globalTypeMappings,
        );
        const tsdocInfo = extractTSDocInfo(node, checker);

        let implementedInterfaces: ReadonlyArray<string> | null = null;
        if (ts.isTypeAliasDeclaration(node)) {
          if (kind === "graphqlInterface") {
            const interfaces = extractImplementsFromDefineInterface(
              node,
              sourceFile,
              checker,
            );
            if (interfaces.length > 0) {
              implementedInterfaces = interfaces;
            }
          } else {
            const interfaces = extractImplementsFromGqlTypeDef(
              node,
              sourceFile,
              checker,
            );
            if (interfaces.length > 0) {
              implementedInterfaces = interfaces;
            }
          }
        }

        const metadata: TypeMetadata = {
          name,
          kind,
          sourceFile: filePath,
          exportKind: hasDefaultExport ? "default" : "named",
          description: tsdocInfo.description,
          deprecated: tsdocInfo.deprecated,
          directives: typeDirectives,
        };

        if (kind === "enum") {
          const enumMembers = extractStringLiteralUnionMembers(
            actualType,
            checker,
          );
          types.push({
            metadata,
            fields: [],
            unionMembers: null,
            inlineObjectMembers: null,
            enumMembers,
            implementedInterfaces: null,
          });
          return;
        }

        const fields =
          kind === "union"
            ? []
            : extractFieldsFromType(actualType, checker, globalTypeMappings);

        if (name.endsWith("Input") && kind === "union") {
          if (
            inlineObjectResult?.hasInlineObjects &&
            inlineObjectResult.hasNamedTypes
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              node.getStart(sourceFile),
            );
            diagnostics.push({
              code: "ONEOF_MIXED_MEMBERS",
              message: `Input union type '${name}' mixes inline object literals with named type references. Use only inline object literals for oneOf input types.`,
              severity: "error",
              location: { file: filePath, line: line + 1, column: 1 },
            });
          } else if (
            inlineObjectResult?.hasNamedTypes &&
            !inlineObjectResult.hasInlineObjects
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              node.getStart(sourceFile),
            );
            diagnostics.push({
              code: "ONEOF_NAMED_TYPE_UNION",
              message: `Input union type '${name}' uses named type references instead of inline object literals. Use inline object pattern: type ${name} = { field1: Type1 } | { field2: Type2 }`,
              severity: "error",
              location: { file: filePath, line: line + 1, column: 1 },
            });
          }
        }

        const inlineObjectMembers =
          inlineObjectResult?.hasInlineObjects &&
          !inlineObjectResult.hasNamedTypes
            ? inlineObjectResult.members
            : null;

        const typeInfo: ExtractedTypeInfo = {
          metadata,
          fields,
          unionMembers: unionMembers ?? null,
          inlineObjectMembers,
          enumMembers: null,
          implementedInterfaces,
        };

        types.push(typeInfo);
      }
    });
  }

  return {
    types,
    diagnostics,
    detectedScalarNames: [...detectedScalarNames],
    detectedScalars,
  };
}
