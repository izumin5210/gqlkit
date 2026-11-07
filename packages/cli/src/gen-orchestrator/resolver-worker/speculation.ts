import type { Program, Symbol as TsSymbol } from "typescript/async";
import {
  type ExtractDefineApiResult,
  extractResolverDefinitions,
} from "../../resolver-extractor/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { RecordedMap, RecordedSet } from "../../shared/recorded-reads.js";
import {
  buildScalarMappingTable,
  type GlobalTypeMapping,
  type ScalarBaseTypeMapping,
  type ScalarBaseTypeMappingTable,
  type ScalarMappingConflict,
  type ScalarMetadataInfo,
} from "../../type-extractor/index.js";

/** What resolver extraction reads from the results of type extraction. */
export interface ResolverExtractionInputs {
  /** Declared type names and the names of types extraction discovered. */
  readonly knownTypeNames: ReadonlyArray<string>;
  /** Scalars declared in the source; none means no scalar mapping table. */
  readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
}

export interface SpeculateResolverDefinitionsParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  /** Declared type names, as collected before type extraction. */
  readonly declaredTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, TsSymbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<TsSymbol, string>;
}

export interface ResolverDefinitionsSpeculation {
  /**
   * The definitions for the actual inputs: the speculative ones if they
   * read the same answers from them, extracted again otherwise.
   */
  readonly settle: (
    inputs: ResolverExtractionInputs,
  ) => Promise<ExtractDefineApiResult>;
}

interface RecordedScalarMappingTable extends ScalarBaseTypeMappingTable {
  readonly inputMappings: RecordedMap<TsSymbol, ScalarBaseTypeMapping>;
  readonly outputMappings: RecordedMap<TsSymbol, ScalarBaseTypeMapping>;
  readonly conflicts: RecordedMap<TsSymbol, ScalarMappingConflict>;
}

function scalarTablesAgree(
  speculated: RecordedScalarMappingTable,
  actual: ScalarBaseTypeMappingTable | null,
): boolean {
  // Field-type resolution only consults the table through lookups, which an
  // empty table and no table answer alike.
  if (actual === null) {
    return true;
  }
  return (
    speculated.inputMappings.agreesWith(actual.inputMappings, Object.is) &&
    speculated.outputMappings.agreesWith(actual.outputMappings, Object.is) &&
    speculated.conflicts.agreesWith(actual.conflicts, Object.is)
  );
}

/**
 * Starts extracting resolver definitions before type extraction has
 * finished, assuming it discovers no types and detects no scalars, and
 * records what the extraction reads of those inputs.
 */
export function speculateResolverDefinitions(
  params: SpeculateResolverDefinitionsParams,
): ResolverDefinitionsSpeculation {
  const { declaredTypeNames, ...rest } = params;
  const knownTypeNames = new RecordedSet(declaredTypeNames);
  const scalarMappingTable: RecordedScalarMappingTable = {
    inputMappings: new RecordedMap(new Map()),
    outputMappings: new RecordedMap(new Map()),
    conflicts: new RecordedMap(new Map()),
  };
  const speculative = extractResolverDefinitions({
    ...rest,
    knownTypeNames,
    scalarMappingTable,
  });
  // Settling observes the failure; until then it must not count as unhandled.
  speculative.catch(() => {});

  return {
    settle: async (inputs) => {
      const definitions = await speculative;
      const actualKnownTypeNames = new Set(inputs.knownTypeNames);
      const actualScalarMappingTable =
        inputs.detectedScalars.length > 0
          ? await buildScalarMappingTable({
              detectedScalars: inputs.detectedScalars,
              checker: params.checker,
              program: params.program,
            })
          : null;
      if (
        knownTypeNames.agreesWith(actualKnownTypeNames) &&
        scalarTablesAgree(scalarMappingTable, actualScalarMappingTable)
      ) {
        return definitions;
      }
      return extractResolverDefinitions({
        ...rest,
        knownTypeNames: actualKnownTypeNames,
        scalarMappingTable: actualScalarMappingTable,
      });
    },
  };
}
