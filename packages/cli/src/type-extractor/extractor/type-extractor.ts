import { resolve } from "node:path";
import ts from "typescript";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { detectDefaultValueMetadata } from "../../shared/default-value-detector.js";
import {
  type DirectiveArgumentValue,
  type DirectiveInfo,
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import { extractInlineObjectProperties as extractInlineObjectPropertiesShared } from "../../shared/inline-object-extractor.js";
import { isInlineObjectType } from "../../shared/inline-object-utils.js";
import {
  extractImplementsFromDefineInterface,
  extractImplementsFromGqlTypeDef,
  isDefineInterfaceTypeAlias,
} from "../../shared/interface-detector.js";
import { detectScalarMetadata } from "../../shared/metadata-detector.js";
import {
  getSourceLocationFromNode,
  type SourceLocation,
} from "../../shared/source-location.js";
import {
  extractTsDocFromSymbol,
  extractTsDocInfo,
} from "../../shared/tsdoc-parser.js";
import {
  getNonNullableTypes,
  isNullableUnion,
  isNullOrUndefined,
} from "../../shared/typescript-utils.js";
import type { ScalarMetadataInfo } from "../collector/scalar-collector.js";
import type {
  Diagnostic,
  EnumMemberInfo,
  ExtractedTypeInfo,
  FieldDefinition,
  InlineObjectMember,
  InlineObjectProperty,
  InlineObjectPropertyDef,
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
  const nonNullTypes = getNonNullableTypes(type);
  return (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
  );
}

interface TypeReferenceResult {
  readonly tsType: TSTypeReference;
}

function extractInlineObjectProperties(
  type: ts.Type,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping>,
): InlineObjectPropertyDef[] {
  return extractInlineObjectPropertiesShared(
    type,
    checker,
    (t, c) => convertTsTypeToReference(t, c, globalTypeMappings).tsType,
  );
}

function findGlobalTypeMapping(
  typeName: string,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping>,
): GlobalTypeMapping | undefined {
  return globalTypeMappings.find((m) => m.typeName === typeName);
}

function convertTsTypeToReference(
  type: ts.Type,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping> = [],
): TypeReferenceResult {
  const metadataResult = detectScalarMetadata(type, checker);
  // Skip scalar detection if it's an array of scalars (e.g., Int[])
  // Array types should be handled by the array handling logic below
  if (
    metadataResult.scalarName &&
    !metadataResult.isPrimitive &&
    !metadataResult.isList
  ) {
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
        inlineObjectProperties: null,
      },
    };
  }

  if (isBooleanUnion(type)) {
    const nullable = isNullableUnion(type);
    return {
      tsType: {
        kind: "primitive",
        name: "boolean",
        elementType: null,
        members: null,
        nullable,
        scalarInfo: null,
        inlineObjectProperties: null,
      },
    };
  }

  if (type.isUnion()) {
    const nullable = isNullableUnion(type);

    // Preserve type alias name for enum types (string literal unions)
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol) {
      const name = aliasSymbol.getName();
      return {
        tsType: {
          kind: "reference",
          name,
          elementType: null,
          members: null,
          nullable,
          scalarInfo: null,
          inlineObjectProperties: null,
        },
      };
    }

    const nonNullTypes = getNonNullableTypes(type);

    if (nonNullTypes.length === 1) {
      const innerResult = convertTsTypeToReference(
        nonNullTypes[0]!,
        checker,
        globalTypeMappings,
      );
      return {
        tsType: { ...innerResult.tsType, nullable },
      };
    }

    const memberResults = nonNullTypes.map((t) =>
      convertTsTypeToReference(t, checker, globalTypeMappings),
    );

    return {
      tsType: {
        kind: "union",
        name: null,
        elementType: null,
        members: memberResults.map((r) => r.tsType),
        nullable,
        scalarInfo: null,
        inlineObjectProperties: null,
      },
    };
  }

  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const elementType = typeArgs?.[0];
    const elementResult = elementType
      ? convertTsTypeToReference(elementType, checker, globalTypeMappings)
      : {
          tsType: {
            kind: "primitive" as const,
            name: "unknown",
            elementType: null,
            members: null,
            nullable: false,
            scalarInfo: null,
            inlineObjectProperties: null,
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
        inlineObjectProperties: null,
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
        inlineObjectProperties: null,
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
        inlineObjectProperties: null,
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
        inlineObjectProperties: null,
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
        inlineObjectProperties: null,
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
        inlineObjectProperties: null,
      },
    };
  }

  // Handle intersection types that should be treated as inline objects
  // This includes intersections with anonymous members OR intersections of
  // named object types (interfaces) that are not exported as GraphQL types
  if (type.isIntersection()) {
    const shouldTreatAsInline = shouldTreatIntersectionAsInline(type);
    if (shouldTreatAsInline) {
      const inlineProperties = extractInlineObjectProperties(
        type,
        checker,
        globalTypeMappings,
      );
      return {
        tsType: {
          kind: "inlineObject",
          name: null,
          elementType: null,
          members: null,
          nullable: false,
          scalarInfo: null,
          inlineObjectProperties: inlineProperties,
        },
      };
    }
  }

  if (isInlineObjectType(type)) {
    const inlineProperties = extractInlineObjectProperties(
      type,
      checker,
      globalTypeMappings,
    );
    return {
      tsType: {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: inlineProperties,
      },
    };
  }

  // Check for utility types (Omit, Pick, Partial, Required, etc.)
  // These create mapped types that should be treated as inline objects
  // Note: Utility types have aliasSymbol (e.g., "Omit") but should still be
  // treated as inline objects since they create new anonymous object types
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    // Mapped types (created by utility types like Omit, Pick, etc.)
    // should be treated as inline objects
    if (objectType.objectFlags & ts.ObjectFlags.Mapped) {
      const inlineProperties = extractInlineObjectProperties(
        type,
        checker,
        globalTypeMappings,
      );
      return {
        tsType: {
          kind: "inlineObject",
          name: null,
          elementType: null,
          members: null,
          nullable: false,
          scalarInfo: null,
          inlineObjectProperties: inlineProperties,
        },
      };
    }
  }

  if (type.symbol) {
    const symbolName = type.symbol.getName();

    // Skip internal TypeScript symbols (see constants.ts for details)
    if (!isInternalTypeSymbol(symbolName)) {
      const globalMapping = findGlobalTypeMapping(
        symbolName,
        globalTypeMappings,
      );
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
            inlineObjectProperties: null,
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
          inlineObjectProperties: null,
        },
      };
    }
  }

  return {
    tsType: {
      kind: "reference",
      name: typeString,
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    },
  };
}

function extractPropertiesFromType(
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

interface FieldExtractionResult {
  fields: FieldDefinition[];
  diagnostics: Diagnostic[];
}

function extractFieldsFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping> = [],
): FieldExtractionResult {
  const fields: FieldDefinition[] = [];
  const diagnostics: Diagnostic[] = [];
  const properties = extractPropertiesFromType(type, checker);

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

    const tsdocInfo = extractTsDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;
    let defaultValue: DirectiveArgumentValue | null = null;

    if (hasDirectiveMetadata(propType)) {
      const directiveResult = detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }

      // Detect default value from $gqlkitFieldMeta
      const defaultValueResult = detectDefaultValueMetadata(propType, checker);
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }
      if (defaultValueResult.errors.length > 0) {
        for (const error of defaultValueResult.errors) {
          diagnostics.push({
            code: error.code,
            message: `Field '${propName}': ${error.message}`,
            severity: "warning",
            location: getSourceLocationFromNode(declaration),
          });
        }
      }

      // Check if the original type is nullable before unwrapping
      // TypeScript normalizes WithDirectives<T | null, [...]> to (T & Directive) | null
      if (isNullableUnion(propType)) {
        directiveNullable = true;
      }
      actualPropType = unwrapDirectiveType(propType, checker);

      // Check if the unwrapped type (from $gqlkitOriginalType) is nullable
      // This handles cases where TypeScript normalizes intersection types
      // and loses the null from the outer union
      if (!directiveNullable && isNullableUnion(actualPropType)) {
        directiveNullable = true;
      }
    }

    const typeResult = convertTsTypeToReference(
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
      defaultValue,
      sourceLocation: getSourceLocationFromNode(declaration),
    });
  }

  return { fields, diagnostics };
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

  const nonNullTypes = getNonNullableTypes(type);

  if (nonNullTypes.length === 0) return false;

  return nonNullTypes.every((t) => t.flags & ts.TypeFlags.StringLiteral);
}

function getEnumMemberName(memberName: ts.PropertyName): string {
  if (ts.isIdentifier(memberName) || ts.isStringLiteral(memberName)) {
    return memberName.text;
  }
  return memberName.getText();
}

function extractEnumMembers(
  node: ts.EnumDeclaration,
  checker: ts.TypeChecker,
): ReadonlyArray<EnumMemberInfo> {
  const members: EnumMemberInfo[] = [];

  for (const member of node.members) {
    const name = getEnumMemberName(member.name);
    const initializer = member.initializer;
    if (initializer && ts.isStringLiteral(initializer)) {
      const symbol = checker.getSymbolAtLocation(member.name);
      const tsdocInfo = symbol
        ? extractTsDocFromSymbol(symbol, checker)
        : { description: undefined, deprecated: undefined };

      members.push({
        name,
        value: initializer.text,
        description: tsdocInfo.description ?? null,
        deprecated: tsdocInfo.deprecated ?? null,
        sourceLocation: getSourceLocationFromNode(member),
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
    if (isNullOrUndefined(t)) {
      continue;
    }
    if (t.flags & ts.TypeFlags.StringLiteral) {
      const value = checker.typeToString(t).replace(/^"|"$/g, "");
      members.push({
        name: value,
        value: value,
        description: null,
        deprecated: null,
        sourceLocation: null,
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

    const unionKind = determineTypeKindFromUnion(type);
    if (unionKind) {
      return unionKind;
    }
    return "object";
  }

  return "object";
}

function determineTypeKindFromUnion(type: ts.Type): TypeKind | null {
  if (!type.isUnion()) {
    return null;
  }

  const nonNullTypes = getNonNullableTypes(type);

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

  return null;
}

function determineTypeKindFromType(
  type: ts.Type,
  originalSymbol: ts.Symbol,
): TypeKind {
  const declarations = originalSymbol.getDeclarations();
  const declaration = declarations?.[0];

  if (declaration && ts.isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (declaration && ts.isEnumDeclaration(declaration)) {
    return "enum";
  }

  const unionKind = determineTypeKindFromUnion(type);
  if (unionKind) {
    return unionKind;
  }

  return "object";
}

function isDeclarationInScannedFiles(
  declaration: ts.Declaration,
  scannedSourceFiles: ReadonlySet<string>,
): boolean {
  const declSourceFileName = resolve(declaration.getSourceFile().fileName);
  return Array.from(scannedSourceFiles).some(
    (sf) => resolve(sf) === declSourceFileName,
  );
}

function createGenericTypeDiagnostic(
  declaration: ts.Declaration,
  exportedName: string,
  location: SourceLocation,
): Diagnostic | null {
  if (
    (ts.isTypeAliasDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration)) &&
    declaration.typeParameters &&
    declaration.typeParameters.length > 0
  ) {
    return {
      code: "UNSUPPORTED_SYNTAX",
      message: `Generic type '${exportedName}' is not supported. Consider using a concrete type instead.`,
      severity: "warning",
      location,
    };
  }
  return null;
}

interface ProcessReexportedSymbolParams {
  readonly exportedName: string;
  readonly resolvedSymbol: ts.Symbol;
  readonly type: ts.Type;
  readonly location: SourceLocation;
  readonly filePath: string;
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly scannedSourceFiles: ReadonlySet<string>;
}

interface ProcessReexportedSymbolResult {
  readonly typeInfo: ExtractedTypeInfo | null;
  readonly diagnostics: Diagnostic[];
  readonly scalarName: string | null;
  readonly scalarMetadata: ScalarMetadataInfo | null;
  readonly skip: boolean;
}

function processReexportedSymbol(
  params: ProcessReexportedSymbolParams,
): ProcessReexportedSymbolResult {
  const {
    exportedName,
    resolvedSymbol,
    type,
    location,
    filePath,
    checker,
    globalTypeMappings,
    scannedSourceFiles,
  } = params;

  const diagnostics: Diagnostic[] = [];

  const scalarMetadataResult = detectScalarMetadata(type, checker);
  if (scalarMetadataResult.scalarName && !scalarMetadataResult.isPrimitive) {
    const tsdocInfo = extractTsDocFromSymbol(resolvedSymbol, checker);
    return {
      typeInfo: null,
      diagnostics: [],
      scalarName: scalarMetadataResult.scalarName,
      scalarMetadata: {
        scalarName: scalarMetadataResult.scalarName,
        typeName: exportedName,
        only: scalarMetadataResult.only,
        sourceFile: filePath,
        line: location.line,
        description: tsdocInfo.description ?? null,
      },
      skip: false,
    };
  }

  const declarations = resolvedSymbol.getDeclarations();
  const declaration = declarations?.[0];
  if (declaration) {
    if (
      isDeclarationInScannedFiles(declaration, scannedSourceFiles) &&
      (ts.isTypeAliasDeclaration(declaration) ||
        ts.isInterfaceDeclaration(declaration) ||
        ts.isEnumDeclaration(declaration))
    ) {
      return {
        typeInfo: null,
        diagnostics: [],
        scalarName: null,
        scalarMetadata: null,
        skip: true,
      };
    }

    const genericDiagnostic = createGenericTypeDiagnostic(
      declaration,
      exportedName,
      location,
    );
    if (genericDiagnostic) {
      diagnostics.push(genericDiagnostic);
    }
  }

  const kind = determineTypeKindFromType(type, resolvedSymbol);
  const tsdocInfo = extractTsDocFromSymbol(resolvedSymbol, checker);

  const metadata: TypeMetadata = {
    name: exportedName,
    kind,
    sourceFile: filePath,
    sourceLocation: location,
    exportKind: "named",
    description: tsdocInfo.description ?? null,
    deprecated: tsdocInfo.deprecated ?? null,
    directives: null,
  };

  if (kind === "enum") {
    const declarations = resolvedSymbol.getDeclarations();
    const declaration = declarations?.[0];
    let enumMembers: ReadonlyArray<EnumMemberInfo>;
    if (declaration && ts.isEnumDeclaration(declaration)) {
      enumMembers = extractEnumMembers(declaration, checker);
    } else {
      enumMembers = extractStringLiteralUnionMembers(type, checker);
    }
    return {
      typeInfo: {
        metadata,
        fields: [],
        unionMembers: null,
        inlineObjectMembers: null,
        enumMembers,
        implementedInterfaces: null,
      },
      diagnostics,
      scalarName: null,
      scalarMetadata: null,
      skip: false,
    };
  }

  const unionMembers = extractUnionMembers(type);
  const fieldResult =
    kind === "union"
      ? { fields: [], diagnostics: [] }
      : extractFieldsFromType(type, checker, globalTypeMappings);
  diagnostics.push(...fieldResult.diagnostics);

  return {
    typeInfo: {
      metadata,
      fields: fieldResult.fields,
      unionMembers: unionMembers ?? null,
      inlineObjectMembers: null,
      enumMembers: null,
      implementedInterfaces: null,
    },
    diagnostics,
    scalarName: null,
    scalarMetadata: null,
    skip: false,
  };
}

interface ProcessExportDeclarationResult {
  readonly types: ExtractedTypeInfo[];
  readonly diagnostics: Diagnostic[];
  readonly detectedScalarNames: string[];
  readonly detectedScalars: ScalarMetadataInfo[];
}

function processExportDeclaration(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  filePath: string,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping>,
  scannedSourceFiles: ReadonlySet<string>,
): ProcessExportDeclarationResult {
  const types: ExtractedTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];
  const detectedScalarNames: string[] = [];
  const detectedScalars: ScalarMetadataInfo[] = [];

  if (!node.isTypeOnly) {
    return { types, diagnostics, detectedScalarNames, detectedScalars };
  }

  const exportClause = node.exportClause;

  const symbolsToProcess: Array<{
    exportedName: string;
    resolvedSymbol: ts.Symbol;
    type: ts.Type;
  }> = [];

  if (exportClause && ts.isNamedExports(exportClause)) {
    for (const specifier of exportClause.elements) {
      const exportedName = specifier.name.text;
      const localTargetSymbol =
        checker.getExportSpecifierLocalTargetSymbol(specifier);
      if (!localTargetSymbol) continue;

      const originalSymbol =
        localTargetSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(localTargetSymbol)
          : localTargetSymbol;
      if (!originalSymbol) continue;

      const type = checker.getDeclaredTypeOfSymbol(originalSymbol);
      symbolsToProcess.push({
        exportedName,
        resolvedSymbol: originalSymbol,
        type,
      });
    }
  } else if (!exportClause && node.moduleSpecifier) {
    const moduleSymbol = checker.getSymbolAtLocation(node.moduleSpecifier);
    if (!moduleSymbol) {
      const location = getSourceLocationFromNode(node)!;
      const modulePath = ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : node.moduleSpecifier.getText(sourceFile);
      diagnostics.push({
        code: "MODULE_RESOLUTION_ERROR",
        message: `Could not resolve module '${modulePath}'`,
        severity: "error",
        location,
      });
      return { types, diagnostics, detectedScalarNames, detectedScalars };
    }

    const exports = checker.getExportsOfModule(moduleSymbol);
    for (const exportedSymbol of exports) {
      const resolvedSymbol =
        exportedSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportedSymbol)
          : exportedSymbol;

      if (
        !(
          resolvedSymbol.flags & ts.SymbolFlags.TypeAlias ||
          resolvedSymbol.flags & ts.SymbolFlags.Interface ||
          resolvedSymbol.flags & ts.SymbolFlags.Enum
        )
      ) {
        continue;
      }

      const type = checker.getDeclaredTypeOfSymbol(resolvedSymbol);
      symbolsToProcess.push({
        exportedName: exportedSymbol.getName(),
        resolvedSymbol,
        type,
      });
    }
  }

  const location = getSourceLocationFromNode(node)!;
  for (const { exportedName, resolvedSymbol, type } of symbolsToProcess) {
    const result = processReexportedSymbol({
      exportedName,
      resolvedSymbol,
      type,
      location,
      filePath,
      checker,
      globalTypeMappings,
      scannedSourceFiles,
    });

    if (result.skip) continue;

    if (result.scalarName && result.scalarMetadata) {
      detectedScalarNames.push(result.scalarName);
      detectedScalars.push(result.scalarMetadata);
      continue;
    }

    diagnostics.push(...result.diagnostics);
    if (result.typeInfo) {
      types.push(result.typeInfo);
    }
  }

  return { types, diagnostics, detectedScalarNames, detectedScalars };
}

function isAnonymousObjectType(memberType: ts.Type): boolean {
  // For type aliases (including GqlObject which creates intersection types),
  // use aliasSymbol to get the original type name
  if (memberType.aliasSymbol) {
    return false;
  }
  if (!memberType.symbol) return true;
  const symbolName = memberType.symbol.getName();
  return symbolName === "__type" || symbolName === "";
}

function isObjectLikeType(type: ts.Type): boolean {
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }
  const objectType = type as ts.ObjectType;
  return (
    (objectType.objectFlags & ts.ObjectFlags.Interface) !== 0 ||
    (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0 ||
    (objectType.objectFlags & ts.ObjectFlags.Mapped) !== 0
  );
}

function shouldTreatIntersectionAsInline(type: ts.IntersectionType): boolean {
  // Case 1: Has at least one anonymous member (e.g., { field: string })
  const hasAnonymousMember = type.types.some(
    (t) => isInlineObjectType(t) || isAnonymousObjectType(t),
  );
  if (hasAnonymousMember) {
    return true;
  }

  // Case 2: All members are object-like types (interfaces, mapped types, etc.)
  // that should be merged into an inline object
  // This handles cases like ContactInfo & AddressInfo where both are interfaces
  const allObjectLike = type.types.every((t) => isObjectLikeType(t));
  if (allObjectLike) {
    return true;
  }

  return false;
}

function getNamedTypeName(memberType: ts.Type): string {
  // For type aliases (e.g., GqlObject<...>), use aliasSymbol
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

  const nonNullTypes = getNonNullableTypes(type);

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
        const tsdocInfo = extractTsDocFromSymbol(prop, checker);
        const typeResult = convertTsTypeToReference(
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

  const nonNullTypes = getNonNullableTypes(type);

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
  const scannedSourceFilesSet = new Set(sourceFiles);

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
        const location = getSourceLocationFromNode(node)!;

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
        const tsdocInfo = extractTsDocInfo(node, checker);
        const metadata: TypeMetadata = {
          name,
          kind: "enum",
          sourceFile: filePath,
          sourceLocation: location,
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
        const typeSourceLocation = getSourceLocationFromNode(node)!;

        if (node.typeParameters && node.typeParameters.length > 0) {
          diagnostics.push({
            code: "UNSUPPORTED_SYNTAX",
            message: `Generic type '${name}' is not supported. Consider using a concrete type instead.`,
            severity: "warning",
            location: typeSourceLocation,
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
          const tsdocInfo = extractTsDocInfo(node, checker);
          detectedScalars.push({
            scalarName: scalarMetadata.scalarName,
            typeName: name,
            only: scalarMetadata.only,
            sourceFile: filePath,
            line: typeSourceLocation.line,
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
            for (const error of directiveResult.errors) {
              diagnostics.push({
                code: error.code,
                message: `Type '${name}': ${error.message}`,
                severity: "error",
                location: typeSourceLocation,
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
        const tsdocInfo = extractTsDocInfo(node, checker);

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
          sourceLocation: typeSourceLocation,
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

        const fieldResult =
          kind === "union"
            ? { fields: [], diagnostics: [] }
            : extractFieldsFromType(actualType, checker, globalTypeMappings);
        const fields = fieldResult.fields;
        diagnostics.push(...fieldResult.diagnostics);

        if (name.endsWith("Input") && kind === "union") {
          if (
            inlineObjectResult?.hasInlineObjects &&
            inlineObjectResult.hasNamedTypes
          ) {
            diagnostics.push({
              code: "ONEOF_MIXED_MEMBERS",
              message: `Input union type '${name}' mixes inline object literals with named type references. Use only inline object literals for oneOf input types.`,
              severity: "error",
              location: {
                ...typeSourceLocation,
                column: 1,
              },
            });
          } else if (
            inlineObjectResult?.hasNamedTypes &&
            !inlineObjectResult.hasInlineObjects
          ) {
            diagnostics.push({
              code: "ONEOF_NAMED_TYPE_UNION",
              message: `Input union type '${name}' uses named type references instead of inline object literals. Use inline object pattern: type ${name} = { field1: Type1 } | { field2: Type2 }`,
              severity: "error",
              location: {
                ...typeSourceLocation,
                column: 1,
              },
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

      if (ts.isExportDeclaration(node)) {
        const result = processExportDeclaration(
          node,
          sourceFile,
          filePath,
          checker,
          globalTypeMappings,
          scannedSourceFilesSet,
        );
        types.push(...result.types);
        diagnostics.push(...result.diagnostics);
        for (const scalarName of result.detectedScalarNames) {
          detectedScalarNames.add(scalarName);
        }
        detectedScalars.push(...result.detectedScalars);
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
