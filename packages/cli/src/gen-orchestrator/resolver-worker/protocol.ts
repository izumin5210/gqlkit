import type { ExtractDefineApiResult } from "../../resolver-extractor/index.js";
import type { GlobalTypeMapping } from "../../type-extractor/index.js";
import type { ResolverExtractionInputs } from "./speculation.js";

/** What the worker needs to build the same program as the main thread. */
export interface ResolverWorkerData {
  readonly cwd: string;
  readonly tsconfigPath: string | null;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
}

/** Sent by the main thread once type extraction has finished. */
export type ResolverWorkerRequest = ResolverExtractionInputs;

export type ResolverWorkerResponse =
  | {
      readonly kind: "definitions";
      /**
       * Null when the worker could not create the program; the main thread
       * reports why when it fails the same way.
       */
      readonly definitions: ExtractDefineApiResult | null;
    }
  | { readonly kind: "error"; readonly error: unknown };
