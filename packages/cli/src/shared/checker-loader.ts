import * as ts from "../core/typescript.js";

/**
 * The extraction stages' only way to ask the TypeScript checker questions,
 * including those answered by methods on `Type`/`Symbol` objects.
 *
 * With the TypeScript 7 API every query is a request to the tsc process. The
 * loader keeps that cheap, DataLoader-style:
 *
 * - Queries issued during the same tick are collected and sent together.
 *   Callers get this by issuing independent queries concurrently (e.g.
 *   `Promise.all`) instead of awaiting them one by one.
 * - Large ticks are split into requests of a few hundred lookups, several of
 *   them in flight at once, so tsc works on one while the client decodes
 *   another. Lookups that the checker takes as arrays (types of symbols,
 *   symbols and types at locations) travel as one array per request.
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
  /**
   * Resolves a symbol's declaration handles into AST nodes. Resolving a
   * handle fetches its whole source file, which for lib or generated types
   * is a large `.d.ts`; prefer the narrower variants below when they suffice.
   */
  readonly getDeclarationsOfSymbol: (
    symbol: ts.Symbol,
  ) => Promise<ReadonlyArray<ts.Declaration>>;
  readonly getFirstDeclarationOfSymbol: (
    symbol: ts.Symbol,
  ) => Promise<ts.Declaration | undefined>;
  /** Resolves only the declarations of `kind`, using the handles' kinds. */
  readonly getDeclarationsOfSymbolOfKind: (
    symbol: ts.Symbol,
    kind: ts.SyntaxKind,
  ) => Promise<ReadonlyArray<ts.Declaration>>;
}

/** A query waiting for the next flush. */
interface PendingQuery {
  /** How many checker lookups it makes, which sizes the requests. */
  readonly lookups: number;
  /** Issues the query and settles whoever waits for it. */
  readonly send: () => Promise<unknown>;
}

/** Hands the queries it has collected to the scheduler when it flushes. */
interface QuerySource {
  readonly drain: () => ReadonlyArray<PendingQuery>;
}

/**
 * Lookups per request and requests in flight. Measured on the 7,600-query
 * prefetch of a 1,400-type project: one request took ~230 ms, 300-lookup
 * requests with up to 4 in flight ~120 ms. Smaller requests or more of them
 * in flight start to contend and get slower again.
 */
const LOOKUPS_PER_REQUEST = 300;
const MAX_REQUESTS_IN_FLIGHT = 4;

interface Scheduler {
  /** Sends `request` with the other queries of the current tick. */
  readonly query: <T>(request: () => Promise<T>) => Promise<T>;
  /** Drains `source` into the requests of the current tick. */
  readonly collect: (source: QuerySource) => void;
}

function createBatchScheduler(api: ts.API): Scheduler {
  let queue: PendingQuery[] = [];
  let sources: QuerySource[] = [];
  let scheduled = false;
  const inFlight = new Set<Promise<unknown>>();

  const send = async (queries: ReadonlyArray<PendingQuery>): Promise<void> => {
    while (inFlight.size >= MAX_REQUESTS_IN_FLIGHT) {
      await Promise.race(inFlight);
    }
    // Queries issued inside one batch context travel as one request,
    // separate from those of other contexts.
    const context = api.batchContext();
    let results: Promise<unknown>[];
    try {
      results = queries.map((query) => query.send());
    } finally {
      context[Symbol.dispose]();
    }
    const settled = Promise.allSettled(results);
    inFlight.add(settled);
    void settled.finally(() => inFlight.delete(settled));
  };

  const flush = async (): Promise<void> => {
    scheduled = false;
    const pending = [...queue, ...sources.flatMap((source) => source.drain())];
    queue = [];
    sources = [];
    let request: PendingQuery[] = [];
    let lookups = 0;
    for (const query of pending) {
      if (request.length > 0 && lookups + query.lookups > LOOKUPS_PER_REQUEST) {
        await send(request);
        request = [];
        lookups = 0;
      }
      request.push(query);
      lookups += query.lookups;
    }
    if (request.length > 0) {
      await send(request);
    }
  };

  const wake = (): void => {
    if (!scheduled) {
      scheduled = true;
      setImmediate(() => void flush());
    }
  };

  return {
    query: <T>(request: () => Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        wake();
        queue.push({
          lookups: 1,
          send: () => {
            const result = request();
            result.then(resolve, reject);
            return result;
          },
        });
      }),
    collect: (source) => {
      wake();
      sources.push(source);
    },
  };
}

interface PendingKey<K, V> {
  readonly key: K;
  readonly resolve: (value: V) => void;
  readonly reject: (error: unknown) => void;
}

interface CreateArrayQueryParams<K, V> {
  readonly scheduler: Scheduler;
  /** The array form of a checker method; results follow the keys' order. */
  readonly loadMany: (keys: K[]) => Promise<readonly V[]>;
  readonly loadOne: (key: K) => Promise<V>;
}

/**
 * Looks up the keys asked for in the same tick with the array form of a
 * checker method: one call per request of up to `LOOKUPS_PER_REQUEST` keys,
 * which saves the per-query overhead of sending them one by one. If a call
 * fails, its keys are looked up one by one, so a key that fails does not
 * fail the others.
 */
function createArrayQuery<K, V>(
  params: CreateArrayQueryParams<K, V>,
): (key: K) => Promise<V> {
  const { scheduler, loadMany, loadOne } = params;
  let pending: PendingKey<K, V>[] = [];
  const source: QuerySource = {
    drain: () => {
      const entries = pending;
      pending = [];
      const queries: PendingQuery[] = [];
      for (
        let start = 0;
        start < entries.length;
        start += LOOKUPS_PER_REQUEST
      ) {
        const chunk = entries.slice(start, start + LOOKUPS_PER_REQUEST);
        queries.push({
          lookups: chunk.length,
          send: () => {
            const result = loadMany(chunk.map((entry) => entry.key));
            result.then(
              (values) => {
                for (const [i, entry] of chunk.entries()) {
                  entry.resolve(values[i] as V);
                }
              },
              () => {
                for (const entry of chunk) {
                  scheduler
                    .query(() => loadOne(entry.key))
                    .then(entry.resolve, entry.reject);
                }
              },
            );
            return result;
          },
        });
      }
      return queries;
    },
  };
  return (key) =>
    new Promise<V>((resolve, reject) => {
      if (pending.length === 0) {
        scheduler.collect(source);
      }
      pending.push({ key, resolve, reject });
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
  const scheduler = createBatchScheduler(api);
  const { query } = scheduler;

  const isArrayType = memoize((type: ts.Type) =>
    query(() => checker.isArrayType(type)),
  );
  const isTupleType = memoize((type: ts.Type) =>
    query(() => checker.isTupleType(type)),
  );
  // Resolving a handle needs no checker: a file the client has answers
  // locally, and the client batches fetches of files it lacks on its own.
  // Queueing it with the checker queries would only delay it by a tick.
  const resolveHandle = memoize((handle: ts.NodeHandle<ts.Declaration>) =>
    handle.resolve(),
  );
  const resolveHandles = async (
    handles: ReadonlyArray<ts.NodeHandle<ts.Declaration>>,
  ): Promise<ReadonlyArray<ts.Declaration>> => {
    const resolved = await Promise.all(handles.map(resolveHandle));
    return resolved.filter((d): d is ts.Declaration => d !== undefined);
  };
  const propertyLookups = new WeakMap<
    ts.Type,
    Map<string, Promise<ts.Symbol | undefined>>
  >();

  return {
    getTypeOfSymbol: memoize(
      createArrayQuery({
        scheduler,
        loadMany: (symbols: ts.Symbol[]) => checker.getTypeOfSymbol(symbols),
        loadOne: (symbol) => checker.getTypeOfSymbol(symbol),
      }),
    ),
    getDeclaredTypeOfSymbol: memoize((symbol) =>
      query(() => checker.getDeclaredTypeOfSymbol(symbol)),
    ),
    getSymbolAtLocation: memoize(
      createArrayQuery({
        scheduler,
        loadMany: (nodes: ts.Node[]) => checker.getSymbolAtLocation(nodes),
        loadOne: (node) => checker.getSymbolAtLocation(node),
      }),
    ),
    getTypeAtLocation: memoize(
      createArrayQuery({
        scheduler,
        loadMany: (nodes: ts.Node[]) => checker.getTypeAtLocation(nodes),
        loadOne: (node) => checker.getTypeAtLocation(node),
      }),
    ),
    getTypeFromTypeNode: memoize((node) =>
      query(() => checker.getTypeFromTypeNode(node)),
    ),
    getAliasedSymbol: memoize((symbol) =>
      query(() => checker.getAliasedSymbol(symbol)),
    ),
    getExportSpecifierLocalTargetSymbol: memoize((node) =>
      query(() => checker.getExportSpecifierLocalTargetSymbol(node)),
    ),
    getExportsOfModule: memoize((symbol) =>
      query(() => checker.getExportsOfModule(symbol)),
    ),
    getDocumentationComment: memoize((symbol) =>
      query(() => checker.getDocumentationCommentOfSymbol(symbol)),
    ),
    getConstantValue: memoize((node) =>
      query(() => checker.getConstantValue(node)),
    ),
    getApparentType: memoize((type) =>
      query(() => checker.getApparentType(type)),
    ),
    getBaseConstraintOfType: memoize((type) =>
      query(() => checker.getBaseConstraintOfType(type)),
    ),
    getIndexInfosOfType: memoize((type) =>
      query(() => checker.getIndexInfosOfType(type)),
    ),
    getTypeArguments: memoize((type) =>
      query(() => checker.getTypeArguments(type)),
    ),
    isArrayType: (type) =>
      isTypeReferenceType(type) ? isArrayType(type) : Promise.resolve(false),
    isTupleType: (type) =>
      isTypeReferenceType(type) ? isTupleType(type) : Promise.resolve(false),
    typeToString: memoize((type) => query(() => checker.typeToString(type))),
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
      const lookup = query(() => type.getProperty(name));
      lookups.set(name, lookup);
      return lookup;
    },
    getPropertiesOfType: memoize((type) => query(() => type.getProperties())),
    getSymbolOfType: memoize((type) => query(() => type.getSymbol())),
    getAliasSymbolOfType: memoize((type) => query(() => type.getAliasSymbol())),
    getAliasTypeArgumentsOfType: memoize((type) =>
      query(() => type.getAliasTypeArguments()),
    ),
    getTypesOfType: memoize((type) => query(() => type.getTypes())),
    getStringIndexTypeOfType: memoize((type) =>
      query(() => type.getStringIndexType()),
    ),
    getParentOfSymbol: memoize((symbol) => query(() => symbol.getParent())),
    getDeclarationsOfSymbol: (symbol) => resolveHandles(symbol.declarations),
    getFirstDeclarationOfSymbol: async (symbol) => {
      const [first] = symbol.declarations;
      return first === undefined ? undefined : resolveHandle(first);
    },
    getDeclarationsOfSymbolOfKind: (symbol, kind) =>
      resolveHandles(symbol.declarations.filter((h) => h.kind === kind)),
  };
}
