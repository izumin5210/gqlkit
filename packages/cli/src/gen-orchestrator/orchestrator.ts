import { dirname, relative, resolve } from "node:path";
import type ts from "typescript";
import type {
  ResolvedOutputConfig,
  ResolvedScalarMapping,
} from "../config-loader/index.js";
import {
  type AbstractResolverInfo,
  type ArgumentDefinition,
  type DefineApiResolverInfo,
  extractDefineApiResolvers,
} from "../resolver-extractor/extractor/define-api-extractor.js";
import type {
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension,
} from "../resolver-extractor/index.js";
import { generateSchema } from "../schema-generator/index.js";

import {
  collectDiagnostics,
  convertTsTypeToGraphQLType,
  type DirectiveDefinitionInfo,
  deduplicateDiagnostics,
  extractDirectiveDefinitions,
  scanDirectory,
  toPosixPath,
} from "../shared/index.js";
import { createSharedProgram } from "../shared/program-factory.js";
import { collectResults } from "../type-extractor/collector/result-collector.js";
import {
  type CollectedScalarType,
  type ConfigScalarMapping,
  collectScalars,
  type ScalarMetadataInfo,
} from "../type-extractor/collector/scalar-collector.js";
import { convertToGraphQL } from "../type-extractor/converter/graphql-converter.js";
import {
  extractTypesFromProgram,
  type GlobalTypeMapping,
} from "../type-extractor/extractor/type-extractor.js";
import { collectDeclaredTypeNames } from "../type-extractor/extractor/type-name-collector.js";
import type {
  Diagnostic,
  Diagnostics,
  ExtractedTypeInfo,
} from "../type-extractor/index.js";
import {
  buildScalarMappingTable,
  type ScalarBaseTypeMappingTable,
} from "../type-extractor/mapper/scalar-base-type-mapper.js";
import { validateTypes } from "../type-extractor/validator/type-validator.js";
import { writeFiles } from "./writer/file-writer.js";

export interface GenerationConfig {
  readonly cwd: string;
  readonly sourceDir: string;
  readonly sourceIgnoreGlobs: ReadonlyArray<string>;
  readonly output: ResolvedOutputConfig;
  readonly configDir: string | null;
  readonly customScalars: ReadonlyArray<ResolvedScalarMapping> | null;
  readonly tsconfigPath: string | null;
}

export interface GeneratedFile {
  readonly filePath: string;
  readonly content: string;
}

export interface GenerationResult {
  readonly success: boolean;
  readonly files: ReadonlyArray<GeneratedFile>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

interface TypesResult {
  types: ReturnType<typeof collectResults>["types"];
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  diagnostics: Diagnostics;
  detectedScalarNames: ReadonlyArray<string>;
  detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
  collectedScalars: ReadonlyArray<CollectedScalarType>;
  scalarMappingTable: ScalarBaseTypeMappingTable | null;
}

interface ResolversResult {
  queryFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  mutationFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  typeExtensions: ReadonlyArray<TypeExtension>;
  abstractTypeResolvers: ReadonlyArray<AbstractResolverInfo>;
  diagnostics: Diagnostics;
}

interface ScalarConfig {
  readonly customScalarNames: string[];
  readonly globalTypeMappings: GlobalTypeMapping[];
  readonly configScalars: ConfigScalarMapping[];
}

interface PipelineContext {
  readonly config: GenerationConfig;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly program: ts.Program | null;
  readonly knownTypeNames: ReadonlySet<string> | null;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol> | null;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string> | null;
  readonly typesResult: TypesResult | null;
  readonly resolversResult: ResolversResult | null;
  readonly directiveDefinitions: DirectiveDefinitionInfo[] | null;
  readonly scalarConfig: ScalarConfig | null;
  readonly diagnostics: Diagnostic[];
  readonly aborted: boolean;
}

function collectAllDiagnostics(
  typesResult: { diagnostics: Diagnostics },
  resolversResult: { diagnostics: Diagnostics },
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  diagnostics.push(...typesResult.diagnostics.errors);
  diagnostics.push(...typesResult.diagnostics.warnings);
  diagnostics.push(...resolversResult.diagnostics.errors);
  diagnostics.push(...resolversResult.diagnostics.warnings);
  return diagnostics;
}

function hasErrors(
  typesResult: { diagnostics: { errors: ReadonlyArray<Diagnostic> } },
  resolversResult: { diagnostics: { errors: ReadonlyArray<Diagnostic> } },
): boolean {
  return (
    typesResult.diagnostics.errors.length > 0 ||
    resolversResult.diagnostics.errors.length > 0
  );
}

interface ExtractTypesCoreParams {
  readonly program: ts.Program;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly customScalarNames: ReadonlyArray<string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly configScalars: ReadonlyArray<ConfigScalarMapping>;
  readonly sourceRoot: string | null;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
}

function extractTypesCore(params: ExtractTypesCoreParams): TypesResult {
  const {
    program,
    sourceFiles,
    customScalarNames,
    globalTypeMappings,
    configScalars,
    sourceRoot,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
  } = params;
  const allDiagnostics: Diagnostic[] = [];

  // Pass 1: Extract types and detect scalars (without scalar mapping table)
  const pass1Result = extractTypesFromProgram(program, sourceFiles, {
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scalarMappingTable: null,
  });

  // Build scalar mapping table from detected scalars
  const scalarMappingTable =
    pass1Result.detectedScalars.length > 0
      ? buildScalarMappingTable({
          detectedScalars: pass1Result.detectedScalars,
          checker: program.getTypeChecker(),
          program,
        })
      : null;

  // Report scalar mapping conflicts as diagnostics
  if (scalarMappingTable) {
    for (const [, conflict] of scalarMappingTable.conflicts) {
      const baseTypeName = conflict.baseTypeSymbol.getName();
      const scalarNames = conflict.conflictingScalars
        .map((s) => s.scalarName)
        .join(", ");
      allDiagnostics.push({
        code: conflict.code,
        message: `Base type '${baseTypeName}' maps to multiple scalars: ${scalarNames}. Use explicit scalar type instead of the base type.`,
        severity: "error",
        location: null,
      });
    }
  }

  // Pass 2: Re-extract types with scalar mapping table (if we have detected scalars)
  const extractionResult = scalarMappingTable
    ? extractTypesFromProgram(program, sourceFiles, {
        globalTypeMappings,
        knownTypeNames,
        knownTypeSymbols,
        underlyingSymbolToTypeName,
        scalarMappingTable,
      })
    : pass1Result;

  allDiagnostics.push(...extractionResult.diagnostics);

  const allCustomScalarNames = [
    ...customScalarNames,
    ...extractionResult.detectedScalarNames,
  ];

  const scalarValidationResult = collectScalars(
    extractionResult.detectedScalars,
    configScalars,
    { sourceRoot },
  );
  const collectedScalars: CollectedScalarType[] = scalarValidationResult.success
    ? [...scalarValidationResult.data]
    : [];
  if (!scalarValidationResult.success) {
    for (const error of scalarValidationResult.errors) {
      allDiagnostics.push({
        code: error.code,
        message: error.message,
        severity: error.severity,
        location: null,
      });
    }
  }

  const conversionResult = convertToGraphQL(extractionResult.types);
  allDiagnostics.push(...conversionResult.diagnostics);

  const validationResult = validateTypes({
    types: conversionResult.types,
    customScalarNames: allCustomScalarNames,
  });
  allDiagnostics.push(...validationResult.diagnostics);

  const result = collectResults(conversionResult.types, allDiagnostics);
  return {
    ...result,
    extractedTypes: extractionResult.types,
    detectedScalarNames: extractionResult.detectedScalarNames,
    detectedScalars: extractionResult.detectedScalars,
    collectedScalars,
    scalarMappingTable,
  };
}

function convertArgsToInputValues(
  args: ReadonlyArray<ArgumentDefinition>,
): GraphQLInputValue[] {
  return args.map((arg) => ({
    name: arg.name,
    type: {
      ...convertTsTypeToGraphQLType(arg.tsType),
      nullable: arg.tsType.nullable || arg.optional,
    },
    description: arg.description,
    deprecated: arg.deprecated,
    defaultValue: arg.defaultValue,
    inlineObjectProperties: arg.tsType.inlineObjectProperties ?? null,
    inlineEnumMembers: arg.tsType.inlineEnumMembers ?? null,
    externalEnumSymbol: arg.tsType.externalEnumSymbol ?? null,
    externalEnumDescription: arg.tsType.externalEnumDescription ?? null,
    externalEnumDeprecated: arg.tsType.externalEnumDeprecated ?? null,
    inlineUnionMembers:
      arg.tsType.kind === "union" ? (arg.tsType.members ?? null) : null,
  }));
}

function convertDefineApiToFields(
  resolvers: ReadonlyArray<DefineApiResolverInfo>,
): {
  queryFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  mutationFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  typeExtensions: ReadonlyArray<TypeExtension>;
} {
  const queryFields: GraphQLFieldDefinition[] = [];
  const mutationFields: GraphQLFieldDefinition[] = [];
  const typeExtensionMap = new Map<string, GraphQLFieldDefinition[]>();

  for (const resolver of resolvers) {
    const returnType = resolver.returnType;
    const fieldDef: GraphQLFieldDefinition = {
      name: resolver.fieldName,
      type: convertTsTypeToGraphQLType(returnType),
      args: resolver.args ? convertArgsToInputValues(resolver.args) : null,
      sourceLocation: resolver.sourceLocation,
      resolverExportName: resolver.fieldName,
      description: resolver.description,
      deprecated: resolver.deprecated,
      directives: resolver.directives,
      returnTypeInlineObjectProperties:
        returnType.inlineObjectProperties ?? null,
      returnTypeInlineObjectDescription:
        returnType.inlineObjectDescription ?? null,
      returnTypeInlineObjectDeprecated:
        returnType.inlineObjectDeprecated ?? null,
      returnTypeInlineEnumMembers: returnType.inlineEnumMembers ?? null,
      returnTypeInlineUnionMembers:
        returnType.kind === "union" ? (returnType.members ?? null) : null,
      returnTypeExternalEnumSymbol: returnType.externalEnumSymbol ?? null,
      returnTypeExternalEnumDescription:
        returnType.externalEnumDescription ?? null,
      returnTypeExternalEnumDeprecated:
        returnType.externalEnumDeprecated ?? null,
    };

    if (resolver.resolverType === "query") {
      queryFields.push(fieldDef);
    } else if (resolver.resolverType === "mutation") {
      mutationFields.push(fieldDef);
    } else if (resolver.resolverType === "field" && resolver.parentTypeName) {
      const existing = typeExtensionMap.get(resolver.parentTypeName) ?? [];
      existing.push(fieldDef);
      typeExtensionMap.set(resolver.parentTypeName, existing);
    }
  }

  const typeExtensions: TypeExtension[] = [];
  for (const [targetTypeName, fields] of typeExtensionMap) {
    typeExtensions.push({ targetTypeName, fields });
  }

  return {
    queryFields: { fields: queryFields },
    mutationFields: { fields: mutationFields },
    typeExtensions,
  };
}

function normalizePathInMessage(message: string, sourceRoot: string): string {
  const normalizedSourceRoot = toPosixPath(sourceRoot);
  const normalizedMessage = message.replaceAll("\\", "/");
  const escapedSourceRoot = normalizedSourceRoot.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const pattern = new RegExp(`${escapedSourceRoot}/`, "g");
  return normalizedMessage.replace(pattern, "");
}

function normalizeDiagnosticPaths(
  diagnostics: ReadonlyArray<Diagnostic>,
  sourceRoot: string,
): Diagnostic[] {
  const normalized = diagnostics.map((d) => {
    const normalizedMessage = normalizePathInMessage(d.message, sourceRoot);

    if (d.location === null) {
      return {
        ...d,
        message: normalizedMessage,
      };
    }
    return {
      ...d,
      message: normalizedMessage,
      location: {
        ...d.location,
        file: toPosixPath(relative(sourceRoot, d.location.file)),
      },
    };
  });
  return deduplicateDiagnostics(normalized);
}

interface ExtractResolversCoreParams {
  readonly program: ts.Program;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
}

function extractResolversCore(
  params: ExtractResolversCoreParams,
): ResolversResult {
  const {
    program,
    sourceFiles,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    globalTypeMappings,
    scalarMappingTable,
  } = params;
  const allDiagnostics: Diagnostic[] = [];

  const sourceFilesSet = new Set(sourceFiles);
  const defineApiExtractionResult = extractDefineApiResolvers(
    program,
    sourceFiles,
    {
      knownTypeNames,
      knownTypeSymbols,
      underlyingSymbolToTypeName,
      globalTypeMappings,
      sourceFiles: sourceFilesSet,
      scalarMappingTable,
    },
  );
  allDiagnostics.push(...defineApiExtractionResult.diagnostics);

  const result = convertDefineApiToFields(defineApiExtractionResult.resolvers);
  return {
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    typeExtensions: result.typeExtensions,
    abstractTypeResolvers: defineApiExtractionResult.abstractTypeResolvers,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}

function buildExcludePaths(
  cwd: string,
  output: ResolvedOutputConfig,
): string[] {
  const paths: string[] = [];
  if (output.resolversPath !== null) {
    paths.push(resolve(cwd, output.resolversPath));
  }
  if (output.typeDefsPath !== null) {
    paths.push(resolve(cwd, output.typeDefsPath));
  }
  if (output.schemaPath !== null) {
    paths.push(resolve(cwd, output.schemaPath));
  }
  return paths;
}

function getOutputDir(output: ResolvedOutputConfig): string {
  const path = output.resolversPath ?? output.typeDefsPath ?? output.schemaPath;
  if (path !== null) {
    return dirname(path);
  }
  return "src/gqlkit/__generated__";
}

function createInitialContext(config: GenerationConfig): PipelineContext {
  return {
    config,
    sourceFiles: [],
    program: null,
    knownTypeNames: null,
    knownTypeSymbols: null,
    underlyingSymbolToTypeName: null,
    typesResult: null,
    resolversResult: null,
    directiveDefinitions: null,
    scalarConfig: null,
    diagnostics: [],
    aborted: false,
  };
}

async function scanSourceFilesStep(
  ctx: PipelineContext,
): Promise<PipelineContext> {
  const absoluteSourceDir = resolve(ctx.config.cwd, ctx.config.sourceDir);
  const excludePaths = buildExcludePaths(ctx.config.cwd, ctx.config.output);

  const scanResult = await scanDirectory(absoluteSourceDir, {
    excludeGlobs: [
      ...ctx.config.sourceIgnoreGlobs,
      "**/*.test.ts",
      "**/*.spec.ts",
    ],
    excludePaths,
  });

  if (scanResult.errors.length > 0) {
    return {
      ...ctx,
      diagnostics: [...ctx.diagnostics, ...scanResult.errors],
      aborted: true,
    };
  }

  return { ...ctx, sourceFiles: scanResult.files };
}

function createProgramStep(ctx: PipelineContext): PipelineContext {
  if (ctx.aborted) return ctx;

  const programResult = createSharedProgram({
    cwd: ctx.config.cwd,
    tsconfigPath: ctx.config.tsconfigPath ?? null,
    typeFiles: ctx.sourceFiles,
    resolverFiles: ctx.sourceFiles,
  });

  if (programResult.diagnostics.length > 0 || !programResult.program) {
    return {
      ...ctx,
      diagnostics: [...ctx.diagnostics, ...programResult.diagnostics],
      aborted: true,
    };
  }

  return { ...ctx, program: programResult.program };
}

function collectTypeNamesStep(ctx: PipelineContext): PipelineContext {
  if (ctx.aborted || !ctx.program) return ctx;

  const result = collectDeclaredTypeNames(ctx.program, ctx.sourceFiles);

  return {
    ...ctx,
    knownTypeNames: result.typeNames,
    knownTypeSymbols: result.typeSymbols,
    underlyingSymbolToTypeName: result.underlyingSymbolToTypeName,
  };
}

function prepareScalarConfig(config: GenerationConfig): ScalarConfig {
  const customScalarNames =
    config.customScalars?.map((s) => s.graphqlName) ?? [];

  const globalTypeMappings: GlobalTypeMapping[] =
    config.customScalars
      ?.filter((s) => s.importPath === null)
      .map((s) => ({
        typeName: s.typeName,
        scalarName: s.graphqlName,
        only: s.only,
      })) ?? [];

  const configScalars: ConfigScalarMapping[] =
    config.customScalars?.map((s) => {
      let sourceFile = "";
      if (s.importPath !== null) {
        if (s.importPath.startsWith(".")) {
          const baseDir = config.configDir ?? config.cwd;
          sourceFile = `${resolve(baseDir, s.importPath)}.ts`;
        } else {
          sourceFile = s.importPath;
        }
      }
      return {
        scalarName: s.graphqlName,
        typeName: s.typeName,
        only: s.only,
        sourceFile,
        line: 1,
        description: s.description,
        fromConfig: true,
      };
    }) ?? [];

  return { customScalarNames, globalTypeMappings, configScalars };
}

function prepareScalarConfigStep(ctx: PipelineContext): PipelineContext {
  if (ctx.aborted) return ctx;

  return { ...ctx, scalarConfig: prepareScalarConfig(ctx.config) };
}

function extractTypesStep(ctx: PipelineContext): PipelineContext {
  if (
    ctx.aborted ||
    !ctx.program ||
    !ctx.knownTypeNames ||
    !ctx.knownTypeSymbols ||
    !ctx.underlyingSymbolToTypeName ||
    !ctx.scalarConfig
  )
    return ctx;

  const { customScalarNames, globalTypeMappings, configScalars } =
    ctx.scalarConfig;

  const typesResult = extractTypesCore({
    program: ctx.program,
    sourceFiles: ctx.sourceFiles,
    customScalarNames,
    globalTypeMappings,
    configScalars,
    sourceRoot: ctx.config.cwd,
    knownTypeNames: ctx.knownTypeNames,
    knownTypeSymbols: ctx.knownTypeSymbols,
    underlyingSymbolToTypeName: ctx.underlyingSymbolToTypeName,
  });

  return { ...ctx, typesResult };
}

function extractResolversStep(ctx: PipelineContext): PipelineContext {
  if (
    ctx.aborted ||
    !ctx.program ||
    !ctx.knownTypeNames ||
    !ctx.knownTypeSymbols ||
    !ctx.underlyingSymbolToTypeName ||
    !ctx.typesResult ||
    !ctx.scalarConfig
  )
    return ctx;

  const { globalTypeMappings } = ctx.scalarConfig;

  const resolversResult = extractResolversCore({
    program: ctx.program,
    sourceFiles: ctx.sourceFiles,
    knownTypeNames: ctx.knownTypeNames,
    knownTypeSymbols: ctx.knownTypeSymbols,
    underlyingSymbolToTypeName: ctx.underlyingSymbolToTypeName,
    globalTypeMappings,
    scalarMappingTable: ctx.typesResult.scalarMappingTable,
  });

  return { ...ctx, resolversResult };
}

function extractDirectivesStep(ctx: PipelineContext): PipelineContext {
  if (ctx.aborted || !ctx.program) return ctx;

  const directiveDefinitionResult = extractDirectiveDefinitions(
    ctx.program,
    ctx.sourceFiles,
  );

  const directiveDefinitions: DirectiveDefinitionInfo[] =
    directiveDefinitionResult.definitions.length > 0
      ? [...directiveDefinitionResult.definitions]
      : [];

  const newDiagnostics = [...ctx.diagnostics];
  for (const error of directiveDefinitionResult.errors) {
    newDiagnostics.push({
      code: error.code,
      message: error.message,
      severity: "error",
      location: {
        file: error.sourceFile,
        line: error.line,
        column: 1,
      },
    });
  }

  return { ...ctx, directiveDefinitions, diagnostics: newDiagnostics };
}

function validateExtractionStep(ctx: PipelineContext): PipelineContext {
  if (ctx.aborted || !ctx.typesResult || !ctx.resolversResult) return ctx;

  const allDiagnostics = [
    ...ctx.diagnostics,
    ...collectAllDiagnostics(ctx.typesResult, ctx.resolversResult),
  ];

  if (hasErrors(ctx.typesResult, ctx.resolversResult)) {
    return {
      ...ctx,
      diagnostics: allDiagnostics,
      aborted: true,
    };
  }

  return { ...ctx, diagnostics: allDiagnostics };
}

function generateSchemaStep(ctx: PipelineContext): {
  ctx: PipelineContext;
  schemaResult: ReturnType<typeof generateSchema> | null;
} {
  if (
    ctx.aborted ||
    !ctx.typesResult ||
    !ctx.resolversResult ||
    !ctx.scalarConfig
  ) {
    return { ctx, schemaResult: null };
  }

  const { customScalarNames } = ctx.scalarConfig;
  const allCustomScalarNames = [
    ...customScalarNames,
    ...ctx.typesResult.detectedScalarNames,
  ];

  const schemaResult = generateSchema({
    typesResult: ctx.typesResult,
    extractedTypes: ctx.typesResult.extractedTypes,
    resolversResult: ctx.resolversResult,
    outputDir: resolve(ctx.config.cwd, getOutputDir(ctx.config.output)),
    customScalarNames: allCustomScalarNames,
    customScalars: ctx.typesResult.collectedScalars,
    directiveDefinitions:
      ctx.directiveDefinitions && ctx.directiveDefinitions.length > 0
        ? ctx.directiveDefinitions
        : null,
    enablePruning: null,
    sourceRoot: ctx.config.cwd,
    knownTypeNames: ctx.knownTypeNames,
  });

  const newDiagnostics = [...ctx.diagnostics, ...schemaResult.diagnostics];

  if (schemaResult.hasErrors) {
    return {
      ctx: { ...ctx, diagnostics: newDiagnostics, aborted: true },
      schemaResult: null,
    };
  }

  return { ctx: { ...ctx, diagnostics: newDiagnostics }, schemaResult };
}

function generateOutputFiles(
  config: GenerationConfig,
  schemaResult: ReturnType<typeof generateSchema>,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (config.output.typeDefsPath !== null) {
    files.push({
      filePath: resolve(config.cwd, config.output.typeDefsPath),
      content: schemaResult.typeDefsCode,
    });
  }

  if (config.output.schemaPath !== null) {
    files.push({
      filePath: resolve(config.cwd, config.output.schemaPath),
      content: schemaResult.sdlContent,
    });
  }

  if (config.output.resolversPath !== null) {
    files.push({
      filePath: resolve(config.cwd, config.output.resolversPath),
      content: schemaResult.resolversCode,
    });
  }

  return files;
}

export async function executeGeneration(
  config: GenerationConfig,
): Promise<GenerationResult> {
  let ctx = createInitialContext(config);

  ctx = await scanSourceFilesStep(ctx);
  ctx = createProgramStep(ctx);
  ctx = collectTypeNamesStep(ctx);
  ctx = prepareScalarConfigStep(ctx);
  ctx = extractTypesStep(ctx);
  ctx = extractResolversStep(ctx);
  ctx = extractDirectivesStep(ctx);
  ctx = validateExtractionStep(ctx);

  if (ctx.aborted) {
    return {
      success: false,
      files: [],
      diagnostics: normalizeDiagnosticPaths(ctx.diagnostics, config.cwd),
    };
  }

  const { ctx: schemaCtx, schemaResult } = generateSchemaStep(ctx);
  ctx = schemaCtx;

  if (ctx.aborted || !schemaResult) {
    return {
      success: false,
      files: [],
      diagnostics: normalizeDiagnosticPaths(ctx.diagnostics, config.cwd),
    };
  }

  const files = generateOutputFiles(config, schemaResult);

  return {
    success: true,
    files,
    diagnostics: normalizeDiagnosticPaths(ctx.diagnostics, config.cwd),
  };
}

export interface WriteFilesConfig {
  readonly files: ReadonlyArray<GeneratedFile>;
}

export interface WriteFilesResult {
  readonly success: boolean;
  readonly filesWritten: ReadonlyArray<string>;
}

export async function writeGeneratedFiles(
  config: WriteFilesConfig,
): Promise<WriteFilesResult> {
  const result = await writeFiles({
    files: config.files.map((f) => ({
      filePath: f.filePath,
      content: f.content,
    })),
  });

  return {
    success: result.success,
    filesWritten: result.writtenPaths,
  };
}
