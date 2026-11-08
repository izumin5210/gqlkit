import type { Program } from "typescript/async";
import type { Diagnostic } from "../../core/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import {
  createDeclaredTypesExtraction,
  type DeclaredTypesExtraction,
  type DiscoveredTypeEntry,
  type ExtractedTypeInfo,
  type ExtractionOptions,
  extractDeclaredTypes,
  type ScalarMetadataInfo,
} from "../../type-extractor/index.js";

/**
 * The registry of discovered types as a range of files sees it when the
 * files before it are extracted elsewhere: names registered by those files
 * are given, and the answers they produce are recorded.
 */
class SliceRegistry extends Map<string, DiscoveredTypeEntry> {
  readonly #prior: ReadonlySet<string>;
  readonly #priorReads = new Map<string, boolean>();

  constructor(prior: ReadonlySet<string>) {
    super();
    this.#prior = prior;
  }

  override has(name: string): boolean {
    if (super.has(name)) {
      return true;
    }
    const registered = this.#prior.has(name);
    this.#priorReads.set(name, registered);
    return registered;
  }

  get priorReads(): ReadonlyArray<readonly [string, boolean]> {
    return [...this.#priorReads];
  }
}

/** The declarations of a range of files, extracted on their own. */
export interface TypeSliceResult {
  readonly types: ReadonlyArray<ExtractedTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  /** In the order the range added them. */
  readonly detectedScalarNames: ReadonlyArray<string>;
  readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
  /** Whether each name asked about was registered before the range. */
  readonly priorRegistryReads: ReadonlyArray<readonly [string, boolean]>;
  /** Names the range registered as discovered types. */
  readonly registeredNames: ReadonlyArray<string>;
}

export interface ExtractTypeSliceParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly files: ReadonlyArray<string>;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly options: ExtractionOptions;
  /** Names the files before the range are assumed to register. */
  readonly priorRegisteredNames: ReadonlySet<string>;
}

export async function extractTypeSlice(
  params: ExtractTypeSliceParams,
): Promise<TypeSliceResult> {
  const { priorRegisteredNames, ...rest } = params;
  const discoveredTypes = new SliceRegistry(priorRegisteredNames);
  const extraction: DeclaredTypesExtraction = {
    ...createDeclaredTypesExtraction(),
    discoveredTypes,
  };
  await extractDeclaredTypes({ ...rest, extraction });
  return {
    types: extraction.types,
    diagnostics: extraction.diagnostics,
    detectedScalarNames: [...extraction.detectedScalarNames],
    detectedScalars: extraction.detectedScalars,
    priorRegistryReads: discoveredTypes.priorReads,
    registeredNames: [...discoveredTypes.keys()],
  };
}

/**
 * Appends a range extracted on its own to the extraction of the files
 * before it, if that gives what extracting them in sequence would: the
 * range registered no types (their entries hold another thread's objects)
 * and every registry answer it got still holds. Returns whether it did.
 */
export function appendTypeSlice(
  extraction: DeclaredTypesExtraction,
  slice: TypeSliceResult,
): boolean {
  if (
    slice.registeredNames.length > 0 ||
    slice.priorRegistryReads.some(
      ([name, registered]) =>
        extraction.discoveredTypes.has(name) !== registered,
    )
  ) {
    return false;
  }
  extraction.types.push(...slice.types);
  extraction.diagnostics.push(...slice.diagnostics);
  for (const name of slice.detectedScalarNames) {
    extraction.detectedScalarNames.add(name);
  }
  extraction.detectedScalars.push(...slice.detectedScalars);
  return true;
}
