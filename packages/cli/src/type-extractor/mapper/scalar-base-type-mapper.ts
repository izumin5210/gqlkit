/**
 * ScalarBaseTypeMapper builds a mapping from base type symbols to scalar names.
 *
 * This enables automatic mapping of base types (e.g., Date) to their corresponding
 * scalar types (e.g., DateTime) when used in field types.
 *
 * The mapper supports:
 * - Input/output context-aware lookups
 * - Conflict detection when multiple scalars share the same base type
 * - Symbol-based comparison for accurate type matching
 */

import ts from "typescript";
import type { ScalarMetadataInfo } from "../collector/scalar-collector.js";

/**
 * Information about a scalar mapping from base type to scalar name.
 */
export interface ScalarBaseTypeMapping {
  /** GraphQL scalar name */
  readonly scalarName: string;
  /** Usage constraint from GqlScalar definition */
  readonly only: "input" | "output" | null;
  /** Source scalar type name for diagnostics */
  readonly sourceTypeName: string;
}

/**
 * Result of a scalar mapping lookup.
 */
export interface ScalarMappingLookupResult {
  readonly mapping: ScalarBaseTypeMapping | null;
  readonly conflict: ScalarMappingConflict | null;
}

/**
 * Information about a scalar mapping conflict.
 */
export interface ScalarMappingConflict {
  readonly code: "AMBIGUOUS_SCALAR_BASE_TYPE";
  readonly baseTypeSymbol: ts.Symbol;
  readonly conflictingScalars: ReadonlyArray<{
    readonly scalarName: string;
    readonly only: "input" | "output" | null;
  }>;
}

/**
 * Context for scalar mapping: input (for args/input types) or output (for return types/object types).
 */
export type ScalarMappingContext = "input" | "output";

/**
 * Mapping table built from scalar definitions.
 */
export interface ScalarBaseTypeMappingTable {
  /** Maps base type symbol to scalar mappings for input context */
  readonly inputMappings: ReadonlyMap<ts.Symbol, ScalarBaseTypeMapping>;
  /** Maps base type symbol to scalar mappings for output context */
  readonly outputMappings: ReadonlyMap<ts.Symbol, ScalarBaseTypeMapping>;
  /** Conflicts detected during table construction */
  readonly conflicts: ReadonlyMap<ts.Symbol, ScalarMappingConflict>;
}

/**
 * Parameters for building a scalar mapping table.
 */
export interface BuildScalarMappingTableParams {
  readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}

/**
 * Extract the base type symbol from a scalar type.
 * For GqlScalar<"DateTime", Date>, this returns the symbol for Date.
 */
function extractBaseTypeSymbol(
  scalarInfo: ScalarMetadataInfo,
  checker: ts.TypeChecker,
  program: ts.Program,
): ts.Symbol | null {
  const sourceFile = program.getSourceFile(scalarInfo.sourceFile);
  if (!sourceFile) {
    return null;
  }

  let foundSymbol: ts.Symbol | null = null;

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      if (name === scalarInfo.typeName) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          const type = checker.getDeclaredTypeOfSymbol(symbol);
          // GqlScalar is an intersection type: Base & { " $gqlkitScalar"?: ... }
          // We need to extract the Base type from this intersection
          if (type.isIntersection()) {
            for (const member of type.types) {
              // Skip the metadata object type
              if (member.getProperty(" $gqlkitScalar")) {
                continue;
              }
              // This should be the base type
              if (member.symbol) {
                foundSymbol = member.symbol;
                return;
              }
            }
          }
        }
      }
    }
  });

  return foundSymbol;
}

/**
 * Builds a scalar mapping table from detected scalars.
 *
 * This function:
 * 1. Extracts base type symbols from each scalar definition
 * 2. Groups mappings by input/output context based on the `only` constraint
 * 3. Detects conflicts when multiple scalars share the same base type in a context
 */
export function buildScalarMappingTable(
  params: BuildScalarMappingTableParams,
): ScalarBaseTypeMappingTable {
  const { detectedScalars, checker, program } = params;

  const inputMappings = new Map<ts.Symbol, ScalarBaseTypeMapping>();
  const outputMappings = new Map<ts.Symbol, ScalarBaseTypeMapping>();
  const conflicts = new Map<ts.Symbol, ScalarMappingConflict>();

  // Track all scalars for each base type symbol to detect conflicts
  const inputCandidates = new Map<
    ts.Symbol,
    Array<{
      scalarName: string;
      only: "input" | "output" | null;
      typeName: string;
    }>
  >();
  const outputCandidates = new Map<
    ts.Symbol,
    Array<{
      scalarName: string;
      only: "input" | "output" | null;
      typeName: string;
    }>
  >();

  for (const scalarInfo of detectedScalars) {
    const baseTypeSymbol = extractBaseTypeSymbol(scalarInfo, checker, program);
    if (!baseTypeSymbol) {
      continue;
    }

    const candidate = {
      scalarName: scalarInfo.scalarName,
      only: scalarInfo.only,
      typeName: scalarInfo.typeName,
    };

    // Register to input context if no constraint or input-only
    if (scalarInfo.only === null || scalarInfo.only === "input") {
      const existing = inputCandidates.get(baseTypeSymbol) ?? [];
      existing.push(candidate);
      inputCandidates.set(baseTypeSymbol, existing);
    }

    // Register to output context if no constraint or output-only
    if (scalarInfo.only === null || scalarInfo.only === "output") {
      const existing = outputCandidates.get(baseTypeSymbol) ?? [];
      existing.push(candidate);
      outputCandidates.set(baseTypeSymbol, existing);
    }
  }

  // Process input mappings and detect conflicts
  for (const [symbol, candidates] of inputCandidates) {
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      inputMappings.set(symbol, {
        scalarName: candidate.scalarName,
        only: candidate.only,
        sourceTypeName: candidate.typeName,
      });
    } else if (candidates.length > 1) {
      conflicts.set(symbol, {
        code: "AMBIGUOUS_SCALAR_BASE_TYPE",
        baseTypeSymbol: symbol,
        conflictingScalars: candidates.map((c) => ({
          scalarName: c.scalarName,
          only: c.only,
        })),
      });
    }
  }

  // Process output mappings and detect conflicts
  for (const [symbol, candidates] of outputCandidates) {
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      outputMappings.set(symbol, {
        scalarName: candidate.scalarName,
        only: candidate.only,
        sourceTypeName: candidate.typeName,
      });
    } else if (candidates.length > 1) {
      // Only add conflict if not already added from input context
      if (!conflicts.has(symbol)) {
        conflicts.set(symbol, {
          code: "AMBIGUOUS_SCALAR_BASE_TYPE",
          baseTypeSymbol: symbol,
          conflictingScalars: candidates.map((c) => ({
            scalarName: c.scalarName,
            only: c.only,
          })),
        });
      }
    }
  }

  return {
    inputMappings,
    outputMappings,
    conflicts,
  };
}

/**
 * Parameters for looking up a scalar mapping.
 */
export interface LookupScalarMappingParams {
  readonly baseTypeSymbol: ts.Symbol;
  readonly context: ScalarMappingContext;
  readonly table: ScalarBaseTypeMappingTable;
}

/**
 * Looks up a scalar mapping for a given base type symbol and context.
 *
 * @returns mapping if found, conflict if detected, or both null if no mapping exists
 */
export function lookupScalarMapping(
  params: LookupScalarMappingParams,
): ScalarMappingLookupResult {
  const { baseTypeSymbol, context, table } = params;

  // Check for conflicts first
  const conflict = table.conflicts.get(baseTypeSymbol);
  if (conflict) {
    return { mapping: null, conflict };
  }

  // Look up mapping based on context
  const mappings =
    context === "input" ? table.inputMappings : table.outputMappings;
  const mapping = mappings.get(baseTypeSymbol);

  return { mapping: mapping ?? null, conflict: null };
}
