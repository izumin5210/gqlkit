import { relative } from "node:path";
import type ts from "typescript";
import type {
  ResolvedOutputConfig,
  ResolvedScalarMapping,
} from "../config-loader/index.js";
import {
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
  scanDirectory,
} from "../shared/index.js";
import { createSharedProgram } from "../shared/program-factory.js";
import { collectResults } from "../type-extractor/collector/result-collector.js";
import { convertToGraphQL } from "../type-extractor/converter/graphql-converter.js";
import { extractTypesFromProgram } from "../type-extractor/extractor/type-extractor.js";
import type { Diagnostic, Diagnostics } from "../type-extractor/index.js";
import { validateTypes } from "../type-extractor/validator/type-validator.js";
import { writeFiles } from "./writer/file-writer.js";

export interface GenerationConfig {
  readonly cwd: string;
  readonly typesDir: string;
  readonly resolversDir: string;
  readonly outputDir: string;
  readonly configDir: string | null;
  readonly customScalars: ReadonlyArray<ResolvedScalarMapping> | null;
  readonly output: ResolvedOutputConfig | null;
  readonly tsconfigPath: string | null;
}

export interface GeneratedFile {
  readonly filename: string;
  readonly content: string;
}

export interface GenerationResult {
  readonly success: boolean;
  readonly files: ReadonlyArray<GeneratedFile>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

interface TypesResult {
  types: ReturnType<typeof collectResults>["types"];
  diagnostics: Diagnostics;
}

interface ResolversResult {
  queryFields: { fields: ReadonlyArray<unknown> };
  mutationFields: { fields: ReadonlyArray<unknown> };
  typeExtensions: ReadonlyArray<unknown>;
  diagnostics: Diagnostics;
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

function extractTypesCore(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
  customScalarNames: ReadonlyArray<string>,
): TypesResult {
  const allDiagnostics: Diagnostic[] = [];

  const extractionResult = extractTypesFromProgram(program, sourceFiles);
  allDiagnostics.push(...extractionResult.diagnostics);

  const conversionResult = convertToGraphQL(extractionResult.types);
  allDiagnostics.push(...conversionResult.diagnostics);

  const validationResult = validateTypes({
    types: conversionResult.types,
    customScalarNames,
  });
  allDiagnostics.push(...validationResult.diagnostics);

  return collectResults(conversionResult.types, allDiagnostics);
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
    const fieldDef: GraphQLFieldDefinition = {
      name: resolver.fieldName,
      type: convertTsTypeToGraphQLType(resolver.returnType),
      args: resolver.args ? convertArgsToInputValues(resolver.args) : null,
      sourceLocation: {
        file: resolver.sourceFile,
        line: 1,
        column: 1,
      },
      resolverExportName: resolver.fieldName,
      description: resolver.description,
      deprecated: resolver.deprecated,
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

function normalizeDiagnosticPaths(
  diagnostics: ReadonlyArray<Diagnostic>,
  sourceRoot: string,
): Diagnostic[] {
  return diagnostics.map((d) => {
    if (d.location === null) {
      return d;
    }
    return {
      ...d,
      location: {
        ...d.location,
        file: relative(sourceRoot, d.location.file),
      },
    };
  });
}

function extractResolversCore(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
): ResolversResult {
  const allDiagnostics: Diagnostic[] = [];

  const defineApiExtractionResult = extractDefineApiResolvers(
    program,
    sourceFiles,
  );
  allDiagnostics.push(...defineApiExtractionResult.diagnostics);

  const result = convertDefineApiToFields(
    defineApiExtractionResult.resolvers as unknown as DefineApiResolverInfo[],
  );
  return {
    queryFields: result.queryFields as ResolversResult["queryFields"],
    mutationFields: result.mutationFields as ResolversResult["mutationFields"],
    typeExtensions: result.typeExtensions as ResolversResult["typeExtensions"],
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}

export async function executeGeneration(
  config: GenerationConfig,
): Promise<GenerationResult> {
  const typeScanResult = await scanDirectory(config.typesDir);
  const resolverScanResult = await scanDirectory(config.resolversDir, {
    excludePatterns: [".test.ts", ".spec.ts"],
  });

  const scanDiagnostics: Diagnostic[] = [
    ...typeScanResult.errors,
    ...resolverScanResult.errors,
  ];

  if (scanDiagnostics.length > 0) {
    return {
      success: false,
      files: [],
      diagnostics: scanDiagnostics,
    };
  }

  const programResult = createSharedProgram({
    cwd: config.cwd,
    tsconfigPath: config.tsconfigPath ?? null,
    typeFiles: typeScanResult.files,
    resolverFiles: resolverScanResult.files,
  });

  if (programResult.diagnostics.length > 0 || !programResult.program) {
    return {
      success: false,
      files: [],
      diagnostics: normalizeDiagnosticPaths(
        programResult.diagnostics,
        config.cwd,
      ),
    };
  }

  const { program } = programResult;
  const customScalarNames =
    config.customScalars?.map((s) => s.graphqlName) ?? [];

  const typesResult = extractTypesCore(
    program,
    typeScanResult.files,
    customScalarNames,
  );
  const resolversResult = extractResolversCore(
    program,
    resolverScanResult.files,
  );

  const allDiagnostics = collectAllDiagnostics(typesResult, resolversResult);

  if (hasErrors(typesResult, resolversResult)) {
    return {
      success: false,
      files: [],
      diagnostics: normalizeDiagnosticPaths(allDiagnostics, config.cwd),
    };
  }

  const schemaResult = generateSchema({
    typesResult: typesResult as Parameters<
      typeof generateSchema
    >[0]["typesResult"],
    resolversResult: resolversResult as Parameters<
      typeof generateSchema
    >[0]["resolversResult"],
    outputDir: config.outputDir,
    customScalarNames,
    enablePruning: null,
    sourceRoot: config.cwd,
  });

  allDiagnostics.push(...schemaResult.diagnostics);

  if (schemaResult.hasErrors) {
    return {
      success: false,
      files: [],
      diagnostics: normalizeDiagnosticPaths(allDiagnostics, config.cwd),
    };
  }

  const files: GeneratedFile[] = [];

  const outputAst = config.output?.ast;
  const outputSdl = config.output?.sdl;

  if (outputAst !== null) {
    const astFilename =
      outputAst && typeof outputAst === "string"
        ? (outputAst.split("/").pop() ?? "schema.ts")
        : "schema.ts";
    files.push({ filename: astFilename, content: schemaResult.typeDefsCode });
  }

  if (outputSdl !== null) {
    const sdlFilename =
      outputSdl && typeof outputSdl === "string"
        ? (outputSdl.split("/").pop() ?? "schema.graphql")
        : "schema.graphql";
    files.push({ filename: sdlFilename, content: schemaResult.sdlContent });
  }

  files.push({ filename: "resolvers.ts", content: schemaResult.resolversCode });

  return {
    success: true,
    files,
    diagnostics: normalizeDiagnosticPaths(allDiagnostics, config.cwd),
  };
}

export interface WriteFilesConfig {
  readonly outputDir: string;
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
    outputDir: config.outputDir,
    files: config.files.map((f) => ({
      filename: f.filename,
      content: f.content,
    })),
  });

  return {
    success: result.success,
    filesWritten: result.writtenPaths,
  };
}
