/**
 * Scalar type registry for branded scalar types.
 *
 * This module manages mapping information from branded TypeScript types
 * to GraphQL scalar types. It provides the foundation for detecting
 * branded scalar types during type extraction.
 */

import { join } from "node:path";
import ts from "typescript";
import type { ResolvedScalarMapping } from "../config-loader/index.js";

/**
 * Represents the mapping information for a branded scalar type.
 */
export interface ScalarMappingInfo {
  /** The name of the branded type (e.g., "IDString", "Int") */
  readonly brandName: string;
  /** The corresponding GraphQL scalar type */
  readonly graphqlScalar: "ID" | "Int" | "Float" | "String" | "Boolean";
  /** The underlying TypeScript primitive type */
  readonly baseType: "string" | "number";
}

/**
 * Extended scalar mapping information for both standard and custom scalars.
 */
export interface ExtendedScalarMappingInfo {
  /** GraphQL scalar name */
  readonly graphqlScalar: string;
  /** TypeScript type name */
  readonly typeName: string;
  /** Resolved import path (absolute) */
  readonly importPath: string;
  /** Whether this is a custom scalar */
  readonly isCustom: boolean;
}

/**
 * Configuration for creating a ScalarRegistry.
 */
export interface ScalarRegistryConfig {
  /** TypeScript program for module resolution */
  readonly program: ts.Program;
  /** Directory containing the config file (for resolving relative paths) */
  readonly configDir?: string;
  /** Custom scalar mappings from config */
  readonly customScalars?: ReadonlyArray<ResolvedScalarMapping>;
}

/**
 * Registry for managing scalar type mappings.
 */
export interface ScalarRegistry {
  /**
   * Get mapping by type name and absolute import path.
   */
  getMapping(
    typeName: string,
    absoluteImportPath: string,
  ): ExtendedScalarMappingInfo | undefined;

  /**
   * Get all custom scalar names.
   */
  getCustomScalarNames(): ReadonlyArray<string>;
}

/**
 * Standard scalar mappings for the 4 branded types provided by @gqlkit-ts/runtime.
 * This map is immutable and serves as the default mapping configuration.
 */
export const STANDARD_SCALAR_MAPPINGS: ReadonlyMap<string, ScalarMappingInfo> =
  new Map<string, ScalarMappingInfo>([
    [
      "IDString",
      Object.freeze({
        brandName: "IDString",
        graphqlScalar: "ID",
        baseType: "string",
      } as const),
    ],
    [
      "IDNumber",
      Object.freeze({
        brandName: "IDNumber",
        graphqlScalar: "ID",
        baseType: "number",
      } as const),
    ],
    [
      "Int",
      Object.freeze({
        brandName: "Int",
        graphqlScalar: "Int",
        baseType: "number",
      } as const),
    ],
    [
      "Float",
      Object.freeze({
        brandName: "Float",
        graphqlScalar: "Float",
        baseType: "number",
      } as const),
    ],
  ]);

/**
 * Retrieves the scalar mapping information for a given branded type name.
 *
 * @param brandName - The name of the branded type to look up
 * @returns The mapping information if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const mapping = getScalarMapping("IDString");
 * if (mapping) {
 *   console.log(mapping.graphqlScalar); // "ID"
 * }
 * ```
 */
export function getScalarMapping(
  brandName: string,
): ScalarMappingInfo | undefined {
  return STANDARD_SCALAR_MAPPINGS.get(brandName);
}

/**
 * Checks if a type name is a known branded scalar type.
 *
 * @param brandName - The name of the type to check
 * @returns true if the type is a known branded scalar, false otherwise
 *
 * @example
 * ```typescript
 * if (isKnownBrandedScalar("IDString")) {
 *   // Handle as branded scalar
 * }
 * ```
 */
export function isKnownBrandedScalar(brandName: string): boolean {
  return STANDARD_SCALAR_MAPPINGS.has(brandName);
}

const GQLKIT_RUNTIME_MODULE = "@gqlkit-ts/runtime";

/**
 * Resolves an import path to an absolute file path using TypeScript's module resolution.
 */
function resolveModulePath(
  importPath: string,
  containingDir: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
): string | undefined {
  const containingFile = join(containingDir, "dummy.ts");
  const result = ts.resolveModuleName(
    importPath,
    containingFile,
    compilerOptions,
    host,
  );

  if (result.resolvedModule) {
    return result.resolvedModule.resolvedFileName;
  }

  return undefined;
}

/**
 * Creates a ScalarRegistry instance.
 *
 * The registry manages both standard branded types from @gqlkit-ts/runtime
 * and custom scalar mappings from the config file.
 */
export function createScalarRegistry(
  config: ScalarRegistryConfig,
): ScalarRegistry {
  const { program, configDir, customScalars = [] } = config;
  const compilerOptions = program.getCompilerOptions();
  const host: ts.ModuleResolutionHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => compilerOptions.baseUrl ?? process.cwd(),
    getDirectories: ts.sys.getDirectories,
    ...(ts.sys.realpath ? { realpath: ts.sys.realpath } : {}),
  };

  const customMappings = new Map<string, ExtendedScalarMappingInfo>();

  if (configDir) {
    for (const scalar of customScalars) {
      const resolvedPath = resolveModulePath(
        scalar.importPath,
        configDir,
        compilerOptions,
        host,
      );

      if (resolvedPath) {
        const key = `${resolvedPath}::${scalar.typeName}`;
        customMappings.set(key, {
          graphqlScalar: scalar.graphqlName,
          typeName: scalar.typeName,
          importPath: resolvedPath,
          isCustom: true,
        });
      }
    }
  }

  return {
    getMapping(
      typeName: string,
      absoluteImportPath: string,
    ): ExtendedScalarMappingInfo | undefined {
      const customKey = `${absoluteImportPath}::${typeName}`;
      const customMapping = customMappings.get(customKey);
      if (customMapping) {
        return customMapping;
      }

      if (absoluteImportPath === GQLKIT_RUNTIME_MODULE) {
        const standardMapping = STANDARD_SCALAR_MAPPINGS.get(typeName);
        if (standardMapping) {
          return {
            graphqlScalar: standardMapping.graphqlScalar,
            typeName: standardMapping.brandName,
            importPath: GQLKIT_RUNTIME_MODULE,
            isCustom: false,
          };
        }
      }

      return undefined;
    },

    getCustomScalarNames(): ReadonlyArray<string> {
      return [
        ...new Set([...customMappings.values()].map((m) => m.graphqlScalar)),
      ];
    },
  };
}
