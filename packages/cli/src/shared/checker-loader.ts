import * as ts from "../core/typescript.js";

/**
 * The extraction stages' only way to ask the TypeScript checker questions,
 * including those answered by methods on `Type`/`Symbol` objects.
 *
 * With the TypeScript 7 API every query is a request to the tsc process. The
 * loader keeps that cheap, DataLoader-style:
 *
 * - Queries issued during the same tick share one round trip: they are
 *   queued and flushed together on `setImmediate` through the sync API's
 *   `api.batch()`. Callers get this by issuing independent queries
 *   concurrently (e.g. `Promise.all`) instead of awaiting them one by one.
 *   The sync transport is used rather than the async API's own batching
 *   because its round trips cost about half as much.
 * - Each distinct query is sent at most once per program. A program never
 *   changes after creation, and the client interns `Type`, `Symbol` and node
 *   objects, so object identity is a sound cache key. The promise itself is
 *   cached, so concurrent callers of an in-flight query share it.
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
  readonly getPropertiesOfType: (
    type: ts.Type,
  ) => Promise<readonly ts.Symbol[]>;
  readonly getSymbolOfType: (type: ts.Type) => Promise<ts.Symbol | undefined>;
  readonly getAliasSymbolOfType: (
    type: ts.Type,
  ) => Promise<ts.Symbol | undefined>;
  readonly getAliasTypeArgumentsOfType: (
    type: ts.Type,
  ) => Promise<readonly ts.Type[]>;
  readonly getTypesOfType: (
    type: ts.UnionOrIntersectionType,
  ) => Promise<readonly ts.Type[]>;
  readonly getStringIndexTypeOfType: (
    type: ts.Type,
  ) => Promise<ts.Type | undefined>;
  readonly getParentOfSymbol: (
    symbol: ts.Symbol,
  ) => Promise<ts.Symbol | undefined>;
  /** Resolves a symbol's declaration handles into AST nodes. */
  readonly getDeclarationsOfSymbol: (
    symbol: ts.Symbol,
  ) => Promise<ReadonlyArray<ts.Declaration>>;
}

type Settled<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

interface PendingQuery {
  readonly request: () => RequestGenerator<unknown>;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
}

/**
 * Keeps one query's failure from failing the whole batch: `api.batch()`
 * throws if any generator throws.
 */
function* settle(
  request: RequestGenerator<unknown>,
): RequestGenerator<Settled<unknown>> {
  try {
    return { ok: true, value: yield* request };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * A `.gen()` method's generator: it yields protocol requests and returns the
 * method's result.
 */
type RequestGenerator<T> = Generator<unknown, T, never>;

type Scheduler = <T>(request: () => RequestGenerator<T>) => Promise<T>;

function createBatchScheduler(api: ts.API): Scheduler {
  let queue: PendingQuery[] = [];

  const flush = (): void => {
    const batch = queue;
    queue = [];
    const results = api.batch(
      ...batch.map(
        (query) => settle(query.request()) as ts.AnyAPIRequestGenerator,
      ),
    ) as Settled<unknown>[];
    batch.forEach((query, index) => {
      const result = results[index]!;
      if (result.ok) {
        query.resolve(result.value);
      } else {
        query.reject(result.error);
      }
    });
  };

  return <T>(request: () => RequestGenerator<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (queue.length === 0) {
        setImmediate(flush);
      }
      queue.push({
        request,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
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

interface CreateCheckerLoaderParams {
  readonly api: ts.API;
  readonly checker: ts.Checker;
}

export function createCheckerLoader(
  params: CreateCheckerLoaderParams,
): CheckerLoader {
  const { api, checker } = params;
  const query = createBatchScheduler(api);

  const isArrayType = memoize((type: ts.Type) =>
    query(() => checker.isArrayType.gen(type)),
  );
  const isTupleType = memoize((type: ts.Type) =>
    query(() => checker.isTupleType.gen(type)),
  );
  const resolveHandle = memoize((handle: ts.NodeHandle<ts.Declaration>) =>
    query(() => handle.resolve.gen()),
  );
  const propertyLookups = new WeakMap<
    ts.Type,
    Map<string, Promise<ts.Symbol | undefined>>
  >();

  return {
    getTypeOfSymbol: memoize((symbol) =>
      query(() => checker.getTypeOfSymbol.gen(symbol)),
    ),
    getDeclaredTypeOfSymbol: memoize((symbol) =>
      query(() => checker.getDeclaredTypeOfSymbol.gen(symbol)),
    ),
    getSymbolAtLocation: memoize((node) =>
      query(() => checker.getSymbolAtLocation.gen(node)),
    ),
    getTypeAtLocation: memoize((node) =>
      query(() => checker.getTypeAtLocation.gen(node)),
    ),
    getTypeFromTypeNode: memoize((node) =>
      query(() => checker.getTypeFromTypeNode.gen(node)),
    ),
    getAliasedSymbol: memoize((symbol) =>
      query(() => checker.getAliasedSymbol.gen(symbol)),
    ),
    getExportSpecifierLocalTargetSymbol: memoize((node) =>
      query(() => checker.getExportSpecifierLocalTargetSymbol.gen(node)),
    ),
    getExportsOfModule: memoize((symbol) =>
      query(() => checker.getExportsOfModule.gen(symbol)),
    ),
    getDocumentationComment: memoize((symbol) =>
      query(() => checker.getDocumentationCommentOfSymbol.gen(symbol)),
    ),
    getConstantValue: memoize((node) =>
      query(() => checker.getConstantValue.gen(node)),
    ),
    getApparentType: memoize((type) =>
      query(() => checker.getApparentType.gen(type)),
    ),
    getBaseConstraintOfType: memoize((type) =>
      query(() => checker.getBaseConstraintOfType.gen(type)),
    ),
    getIndexInfosOfType: memoize((type) =>
      query(() => checker.getIndexInfosOfType.gen(type)),
    ),
    getTypeArguments: memoize((type) =>
      query(() => checker.getTypeArguments.gen(type)),
    ),
    isArrayType: (type) =>
      isTypeReferenceType(type) ? isArrayType(type) : Promise.resolve(false),
    isTupleType: (type) =>
      isTypeReferenceType(type) ? isTupleType(type) : Promise.resolve(false),
    typeToString: memoize((type) =>
      query(() => checker.typeToString.gen(type)),
    ),
    getPropertyOfType: (type, name) => {
      let lookups = propertyLookups.get(type);
      if (lookups === undefined) {
        lookups = new Map();
        propertyLookups.set(type, lookups);
      }
      const cached = lookups.get(name);
      if (cached !== undefined) {
        return cached;
      }
      const lookup = query(() => type.getProperty.gen(name));
      lookups.set(name, lookup);
      return lookup;
    },
    getPropertiesOfType: memoize((type) =>
      query(() => type.getProperties.gen()),
    ),
    getSymbolOfType: memoize((type) => query(() => type.getSymbol.gen())),
    getAliasSymbolOfType: memoize((type) =>
      query(() => type.getAliasSymbol.gen()),
    ),
    getAliasTypeArgumentsOfType: memoize((type) =>
      query(() => type.getAliasTypeArguments.gen()),
    ),
    getTypesOfType: memoize((type) => query(() => type.getTypes.gen())),
    getStringIndexTypeOfType: memoize((type) =>
      query(() => type.getStringIndexType.gen()),
    ),
    getParentOfSymbol: memoize((symbol) => query(() => symbol.getParent.gen())),
    getDeclarationsOfSymbol: memoize(async (symbol) => {
      const resolved = await Promise.all(
        symbol.declarations.map(resolveHandle),
      );
      return resolved.filter((d): d is ts.Declaration => d !== undefined);
    }),
  };
}
