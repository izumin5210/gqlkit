import type {
  ExtensionField,
  IntegratedResult,
  TypeExtension,
} from "../integrator/result-integrator.js";

export interface FieldResolver {
  readonly fieldName: string;
  readonly sourceFile: string;
  readonly resolverValueName: string;
  readonly isDirectExport: boolean;
}

export interface TypeResolvers {
  readonly typeName: string;
  readonly fields: ReadonlyArray<FieldResolver>;
}

/**
 * Information about a custom scalar type for resolver generation.
 */
export interface CustomScalarInfo {
  readonly scalarName: string;
  readonly inputTypeName: string;
  readonly outputTypeName: string;
  readonly typeImportPath: string | null;
}

export interface ResolverInfo {
  readonly types: ReadonlyArray<TypeResolvers>;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly customScalars: ReadonlyArray<CustomScalarInfo>;
}

function getResolverValueName(typeName: string): string {
  return `${typeName.charAt(0).toLowerCase()}${typeName.slice(1)}Resolver`;
}

function collectFieldResolver(
  field: ExtensionField,
  fallbackResolverValueName: string,
): FieldResolver {
  const isDirectExport = field.resolverExportName !== null;
  const resolverValueName = isDirectExport
    ? field.resolverExportName!
    : fallbackResolverValueName;

  return {
    fieldName: field.name,
    sourceFile: field.resolverSourceFile,
    resolverValueName,
    isDirectExport,
  };
}

function collectFieldResolvers(ext: TypeExtension): FieldResolver[] {
  const fallbackResolverValueName = getResolverValueName(ext.targetTypeName);

  return ext.fields.map((field) =>
    collectFieldResolver(field, fallbackResolverValueName),
  );
}

export function collectResolverInfo(
  integratedResult: IntegratedResult,
  customScalars?: ReadonlyArray<CustomScalarInfo>,
): ResolverInfo {
  const typeMap = new Map<string, FieldResolver[]>();
  const sourceFilesSet = new Set<string>();

  for (const ext of integratedResult.typeExtensions) {
    const fieldResolvers = collectFieldResolvers(ext);

    for (const resolver of fieldResolvers) {
      sourceFilesSet.add(resolver.sourceFile);
    }

    const existing = typeMap.get(ext.targetTypeName) ?? [];
    typeMap.set(ext.targetTypeName, [...existing, ...fieldResolvers]);
  }

  const types: TypeResolvers[] = [...typeMap.entries()]
    .map(([typeName, fields]) => ({
      typeName,
      fields: [...fields].sort((a, b) =>
        a.fieldName.localeCompare(b.fieldName),
      ),
    }))
    .sort((a, b) => a.typeName.localeCompare(b.typeName));

  const sourceFiles = [...sourceFilesSet].sort((a, b) => a.localeCompare(b));

  return {
    types,
    sourceFiles,
    customScalars: customScalars ?? [],
  };
}
