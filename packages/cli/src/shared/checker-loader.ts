import * as ts from "../core/typescript.js";

/**
 * The extraction stages' only way to ask the TypeScript checker questions.
 *
 * With the TypeScript 7 API every checker query is a request to the tsc
 * process. The loader keeps that cheap, DataLoader-style:
 *
 * - Queries issued in the same tick share one round trip: the async API
 *   client queues requests and flushes them as a single batch on
 *   `setImmediate`. Callers get this by issuing independent queries
 *   concurrently (e.g. `Promise.all`) instead of awaiting them one by one.
 * - Each distinct query is sent at most once per program. A program never
 *   changes after creation, and the client interns `Type`, `Symbol` and node
 *   objects, so object identity is a sound cache key. The promise itself is
 *   cached, so concurrent callers of an in-flight query share it.
 *
 * Methods on `Type`/`Symbol` objects (`getSymbol()`, `getTypes()`, …) are
 * cached by the client itself and are called directly.
 */
export interface CheckerLoader {
  readonly getTypeOfSymbol: (symbol: ts.Symbol) => Promise<ts.Type>;
  readonly getDeclaredTypeOfSymbol: (symbol: ts.Symbol) => Promise<ts.Type>;
  readonly getSymbolAtLocation: (
    node: ts.Node,
  ) => Promise<ts.Symbol | undefined>;
  readonly getTypeAtLocation: (node: ts.Node) => Promise<ts.Type>;
  readonly getTypeFromTypeNode: (node: ts.TypeNode) => Promise<ts.Type>;
  readonly getAliasedSymbol: (symbol: ts.Symbol) => Promise<ts.Symbol>;
  readonly getExportSpecifierLocalTargetSymbol: (
    node: ts.Node,
  ) => Promise<ts.Symbol | undefined>;
  readonly getExportsOfModule: (
    symbol: ts.Symbol,
  ) => Promise<readonly ts.Symbol[]>;
  readonly getDocumentationComment: (symbol: ts.Symbol) => Promise<string>;
  readonly getConstantValue: (
    node: ts.Node,
  ) => Promise<string | number | undefined>;
  readonly getApparentType: (type: ts.Type) => Promise<ts.Type>;
  readonly getBaseConstraintOfType: (
    type: ts.Type,
  ) => Promise<ts.Type | undefined>;
  readonly getIndexInfosOfType: (
    type: ts.Type,
  ) => Promise<readonly ts.IndexInfo[]>;
  readonly getTypeArguments: (
    type: ts.TypeReference,
  ) => Promise<readonly ts.Type[]>;
  readonly isArrayType: (type: ts.Type) => Promise<boolean>;
  readonly isTupleType: (type: ts.Type) => Promise<boolean>;
  readonly typeToString: (type: ts.Type) => Promise<string>;
  /**
   * Looks up one property by name. Asking for the single name, rather than
   * listing a type's properties once and searching locally, keeps the cost
   * independent of the type's size: generated ORM or lib types can have
   * hundreds of members, and the lookups batch anyway.
   */
  readonly getPropertyOfType: (
    type: ts.Type,
    name: string,
  ) => Promise<ts.Symbol | undefined>;
}

function memoize<K extends object, V>(
  load: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const cache = new WeakMap<K, Promise<V>>();
  return (key) => {
    let promise = cache.get(key);
    if (promise === undefined) {
      promise = load(key);
      cache.set(key, promise);
      // A failed request must not poison later lookups of the same key.
      promise.catch(() => cache.delete(key));
    }
    return promise;
  };
}

/**
 * `isArrayType` and `isTupleType` only hold for type references (the
 * checker tests `ObjectFlags.Reference` before comparing the target), so
 * anything else is answered without a request.
 */
function isTypeReferenceType(type: ts.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0
  );
}

export function createCheckerLoader(checker: ts.Checker): CheckerLoader {
  const isArrayType = memoize((type: ts.Type) => checker.isArrayType(type));
  const isTupleType = memoize((type: ts.Type) => checker.isTupleType(type));

  const propertyLookups = new WeakMap<
    ts.Type,
    Map<string, Promise<ts.Symbol | undefined>>
  >();

  return {
    getTypeOfSymbol: memoize((symbol) => checker.getTypeOfSymbol(symbol)),
    getDeclaredTypeOfSymbol: memoize((symbol) =>
      checker.getDeclaredTypeOfSymbol(symbol),
    ),
    getSymbolAtLocation: memoize((node) => checker.getSymbolAtLocation(node)),
    getTypeAtLocation: memoize((node) => checker.getTypeAtLocation(node)),
    getTypeFromTypeNode: memoize((node) => checker.getTypeFromTypeNode(node)),
    getAliasedSymbol: memoize((symbol) => checker.getAliasedSymbol(symbol)),
    getExportSpecifierLocalTargetSymbol: memoize((node) =>
      checker.getExportSpecifierLocalTargetSymbol(node),
    ),
    getExportsOfModule: memoize((symbol) => checker.getExportsOfModule(symbol)),
    getDocumentationComment: memoize((symbol) =>
      checker.getDocumentationCommentOfSymbol(symbol),
    ),
    getConstantValue: memoize((node) => checker.getConstantValue(node)),
    getApparentType: memoize((type) => checker.getApparentType(type)),
    getBaseConstraintOfType: memoize((type) =>
      checker.getBaseConstraintOfType(type),
    ),
    getIndexInfosOfType: memoize((type) => checker.getIndexInfosOfType(type)),
    getTypeArguments: memoize((type) => checker.getTypeArguments(type)),
    isArrayType: (type) =>
      isTypeReferenceType(type) ? isArrayType(type) : Promise.resolve(false),
    isTupleType: (type) =>
      isTypeReferenceType(type) ? isTupleType(type) : Promise.resolve(false),
    typeToString: memoize((type) => checker.typeToString(type)),
    getPropertyOfType: (type, name) => {
      let lookups = propertyLookups.get(type);
      if (lookups === undefined) {
        lookups = new Map();
        propertyLookups.set(type, lookups);
      }
      let lookup = lookups.get(name);
      if (lookup === undefined) {
        lookup = type.getProperty(name);
        lookups.set(name, lookup);
      }
      return lookup;
    },
  };
}
