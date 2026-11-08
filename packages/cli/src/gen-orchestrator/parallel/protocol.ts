import type { ExtractDefineApiResult } from "../../resolver-extractor/index.js";
import type { DirectiveDefinitionExtractionResult } from "../../shared/index.js";
import type { SymbolKey } from "../../shared/typescript-utils.js";
import type {
  GlobalTypeMapping,
  ScalarMetadataInfo,
  TypeNameRegistration,
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
      /** The declared type names (see `collectDeclaredTypeNames`). */
      readonly kind: "type-names";
      readonly typeNames: ReadonlyArray<string>;
      readonly typeSymbols: ReadonlyArray<readonly [string, SymbolKey]>;
      readonly underlyingSymbolToTypeName: ReadonlyArray<
        readonly [SymbolKey, string]
      >;
    }
  | {
      /** Whether the worker's types looked up any of these scalars' base types. */
      readonly kind: "check-scalar-reads";
      readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
    }
  | { readonly kind: "resolvers"; readonly inputs: ResolverExtractionInputs };

/**
 * Sent by the worker: that it loaded, then the type names its range
 * exports, then the types once it has the type names, then one reply per
 * later request.
 */
export type SliceWorkerResponse =
  | { readonly kind: "ready" }
  | {
      readonly kind: "type-name-registrations";
      readonly registrations: ReadonlyArray<TypeNameRegistration>;
      /** See `collectLocalTypeDeclarationNames`. */
      readonly localTypeDeclarationNames: ReadonlyArray<string>;
    }
  | {
      readonly kind: "types";
      readonly result: TypeSliceResult;
      readonly directives: DirectiveDefinitionExtractionResult;
    }
  | { readonly kind: "scalar-reads"; readonly unread: boolean }
  | {
      readonly kind: "definitions";
      readonly definitions: ExtractDefineApiResult;
    }
  | { readonly kind: "error"; readonly error: unknown };
