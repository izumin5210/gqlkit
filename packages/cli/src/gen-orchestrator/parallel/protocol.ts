import type { ExtractDefineApiResult } from "../../resolver-extractor/index.js";
import type {
  GlobalTypeMapping,
  ScalarMetadataInfo,
} from "../../type-extractor/index.js";
import type { ResolverExtractionInputs } from "./resolver-speculation.js";
import type { TypeSliceResult } from "./type-slice.js";

export interface SliceWorkerData {
  readonly cwd: string;
  readonly tsconfigPath: string | null;
  /** Every scanned source file, which the program is built from. */
  readonly sourceFiles: ReadonlyArray<string>;
  /** The range of files this worker extracts. */
  readonly files: ReadonlyArray<string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
}

/** Sent by the main thread, in this order, once it has the answers. */
export type SliceWorkerRequest =
  | {
      /** Whether the worker's types looked up any of these scalars' base types. */
      readonly kind: "check-scalar-reads";
      readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
    }
  | { readonly kind: "resolvers"; readonly inputs: ResolverExtractionInputs };

/** Sent by the worker: the types unprompted, then one reply per request. */
export type SliceWorkerResponse =
  | { readonly kind: "types"; readonly result: TypeSliceResult }
  | { readonly kind: "scalar-reads"; readonly unread: boolean }
  | {
      readonly kind: "definitions";
      readonly definitions: ExtractDefineApiResult;
    }
  | { readonly kind: "error"; readonly error: unknown };
