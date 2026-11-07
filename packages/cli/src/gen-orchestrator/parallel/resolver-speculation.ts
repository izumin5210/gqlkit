import type { Program, Symbol as TsSymbol } from "typescript/async";
import {
  type ExtractDefineApiResult,
  extractResolverDefinitions,
} from "../../resolver-extractor/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { RecordedSet } from "../../shared/recorded-reads.js";
import {
  buildScalarMappingTable,
  createRecordedScalarMappingTable,
  type GlobalTypeMapping,
  isScalarMappingTableUnread,
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
  /** The files whose resolvers to extract, in order. */
  readonly files: ReadonlyArray<string>;
  /** Every scanned source file. */
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
  const scalarMappingTable = createRecordedScalarMappingTable();
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
        isScalarMappingTableUnread(scalarMappingTable, actualScalarMappingTable)
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
