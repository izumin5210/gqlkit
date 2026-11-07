import type { Declaration, Node, SyntaxKind, TypeNode } from "typescript/ast";
import {
  type API,
  type Checker,
  type IndexInfo,
  type NodeHandle,
  ObjectFlags,
  type ObjectType,
  type Symbol as TsSymbol,
  type Type,
  TypeFlags,
  type TypeReference,
  type UnionOrIntersectionType,
} from "typescript/async";
import { METADATA_PROPERTIES } from "../core/index.js";
import { getLocalDocumentationComment } from "./local-documentation.js";

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
  readonly getTypeOfSymbol: (symbol: TsSymbol) => Promise<Type>;
  readonly getDeclaredTypeOfSymbol: (symbol: TsSymbol) => Promise<Type>;
  readonly getSymbolAtLocation: (node: Node) => Promise<TsSymbol | undefined>;
  readonly getTypeAtLocation: (node: Node) => Promise<Type>;
  readonly getTypeFromTypeNode: (node: TypeNode) => Promise<Type>;
  readonly getAliasedSymbol: (symbol: TsSymbol) => Promise<TsSymbol>;
  readonly getExportSpecifierLocalTargetSymbol: (
    node: Node,
  ) => Promise<TsSymbol | undefined>;
  readonly getExportsOfModule: (
    symbol: TsSymbol,
  ) => Promise<readonly TsSymbol[]>;
  readonly getDocumentationComment: (symbol: TsSymbol) => Promise<string>;
  readonly getConstantValue: (
    node: Node,
  ) => Promise<string | number | undefined>;
  readonly getApparentType: (type: Type) => Promise<Type>;
  readonly getBaseConstraintOfType: (type: Type) => Promise<Type | undefined>;
  readonly getIndexInfosOfType: (type: Type) => Promise<readonly IndexInfo[]>;
  readonly getTypeArguments: (type: TypeReference) => Promise<readonly Type[]>;
  readonly isArrayType: (type: Type) => Promise<boolean>;
  readonly isTupleType: (type: Type) => Promise<boolean>;
  readonly typeToString: (type: Type) => Promise<string>;
  /**
   * Looks up one property by name. Asking for the single name, rather than
   * listing a type's properties once and searching locally, keeps the cost
   * independent of the type's size: generated ORM or lib types can have
   * hundreds of members, and the lookups batch anyway.
   */
  readonly getPropertyOfType: (
    type: Type,
    name: string,
  ) => Promise<TsSymbol | undefined>;
  readonly getPropertiesOfType: (type: Type) => Promise<readonly TsSymbol[]>;
  readonly getSymbolOfType: (type: Type) => Promise<TsSymbol | undefined>;
  readonly getAliasSymbolOfType: (type: Type) => Promise<TsSymbol | undefined>;
  readonly getAliasTypeArgumentsOfType: (
    type: Type,
  ) => Promise<readonly Type[]>;
  readonly getTypesOfType: (
    type: UnionOrIntersectionType,
  ) => Promise<readonly Type[]>;
  readonly getStringIndexTypeOfType: (type: Type) => Promise<Type | undefined>;
  readonly getParentOfSymbol: (
    symbol: TsSymbol,
  ) => Promise<TsSymbol | undefined>;
  /**
   * Resolves a symbol's declaration handles into AST nodes. Resolving a
   * handle fetches its whole source file, which for lib or generated types
   * is a large `.d.ts`; prefer the narrower variants below when they suffice.
   */
  readonly getDeclarationsOfSymbol: (
    symbol: TsSymbol,
  ) => Promise<ReadonlyArray<Declaration>>;
  readonly getFirstDeclarationOfSymbol: (
    symbol: TsSymbol,
  ) => Promise<Declaration | undefined>;
  /** Resolves only the declarations of `kind`, using the handles' kinds. */
  readonly getDeclarationsOfSymbolOfKind: (
    symbol: TsSymbol,
    kind: SyntaxKind,
  ) => Promise<ReadonlyArray<Declaration>>;
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

function createBatchScheduler(api: API): Scheduler {
  let queue: PendingQuery[] = [];
  let sources: QuerySource[] = [];
  let scheduled = false;
  const inFlight = new Set<Promise<unknown>>();

  const issue = (
    queries: ReadonlyArray<PendingQuery>,
  ): ReadonlyArray<Promise<unknown>> => {
    // Queries issued inside one batch context travel as one request,
    // separate from those of other contexts.
    using _batch = api.batchContext();
    return queries.map((query) => query.send());
  };

  const send = async (queries: ReadonlyArray<PendingQuery>): Promise<void> => {
    while (inFlight.size >= MAX_REQUESTS_IN_FLIGHT) {
      await Promise.race(inFlight);
    }
    const settled = Promise.allSettled(issue(queries));
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
  const cache = new Map<K, Promise<V>>();
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
function isTypeReferenceType(type: Type): boolean {
  return (
    (type.flags & TypeFlags.Object) !== 0 &&
    ((type as ObjectType).objectFlags & ObjectFlags.Reference) !== 0
  );
}

const METADATA_PROPERTY_NAMES: ReadonlySet<string> = new Set(
  Object.values(METADATA_PROPERTIES),
);

/**
 * Whether `getPropertyOfType(type, name)` is the property of that name in
 * the type's property list. For an object type, the checker looks the name
 * up among the members it lists, and then among the members of the global
 * `Object` (or `Function`) interface, which have no gqlkit metadata names.
 * Unions and intersections synthesize properties, and unions also consult
 * index signatures, so they are asked as usual.
 */
function isAnsweredByPropertyList(type: Type, name: string): boolean {
  return (
    (type.flags & TypeFlags.Object) !== 0 &&
    METADATA_PROPERTY_NAMES.has(name)
  );
}

/**
 * Whether `getPropertyOfType(type, name)` is known to be undefined: the
 * checker looks up properties of primitives and literals on their global
 * interface (`String`, `Number`, ...), which have no gqlkit metadata names,
 * and `any`, `unknown`, `null`, `undefined` and `never` have none.
 */
function hasNoMetadataProperty(type: Type, name: string): boolean {
  return (
    (type.flags &
      (TypeFlags.Primitive | TypeFlags.AnyOrUnknown | TypeFlags.Never)) !==
      0 &&
    (type.flags & TypeFlags.StructuredOrInstantiable) === 0 &&
    METADATA_PROPERTY_NAMES.has(name)
  );
}

interface CreateCheckerLoaderParams {
  readonly api: API;
  readonly checker: Checker;
  /**
   * Paths (`SourceFile.path`) of the files the client has already fetched.
   * Questions answerable from their syntax trees are answered locally.
   */
  readonly loadedFilePaths: ReadonlySet<string>;
}

export function createCheckerLoader(
  params: CreateCheckerLoaderParams,
): CheckerLoader {
  const { api, checker, loadedFilePaths } = params;
  const scheduler = createBatchScheduler(api);
  const { query } = scheduler;

  const isArrayType = memoize((type: Type) =>
    query(() => checker.isArrayType(type)),
  );
  const isTupleType = memoize((type: Type) =>
    query(() => checker.isTupleType(type)),
  );
  // Resolving a handle needs no checker: a file the client has answers
  // locally, and the client batches fetches of files it lacks on its own.
  // Queueing it with the checker queries would only delay it by a tick.
  const resolveHandle = memoize((handle: NodeHandle<Declaration>) =>
    handle.resolve(),
  );
  const resolveHandles = async (
    handles: ReadonlyArray<NodeHandle<Declaration>>,
  ): Promise<ReadonlyArray<Declaration>> => {
    const resolved = await Promise.all(handles.map(resolveHandle));
    return resolved.filter((d): d is Declaration => d !== undefined);
  };
  const getSymbolAtLocation = memoize(
    createArrayQuery({
      scheduler,
      loadMany: (nodes: Node[]) => checker.getSymbolAtLocation(nodes),
      loadOne: (node) => checker.getSymbolAtLocation(node),
    }),
  );
  const localDocumentation = {
    isLoadedFile: (path: string) => loadedFilePaths.has(path),
    resolveHandle,
    getSymbolAtLocation,
  };
  const propertyLists = new Map<Type, Promise<readonly TsSymbol[]>>();
  const propertyLookups = new Map<
    Type,
    Map<string, Promise<TsSymbol | undefined>>
  >();

  return {
    getTypeOfSymbol: memoize(
      createArrayQuery({
        scheduler,
        loadMany: (symbols: TsSymbol[]) => checker.getTypeOfSymbol(symbols),
        loadOne: (symbol) => checker.getTypeOfSymbol(symbol),
      }),
    ),
    getDeclaredTypeOfSymbol: memoize((symbol) =>
      query(() => checker.getDeclaredTypeOfSymbol(symbol)),
    ),
    getSymbolAtLocation,
    getTypeAtLocation: memoize(
      createArrayQuery({
        scheduler,
        loadMany: (nodes: Node[]) => checker.getTypeAtLocation(nodes),
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
    getDocumentationComment: memoize(
      async (symbol) =>
        (await getLocalDocumentationComment(localDocumentation, symbol)) ??
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
      const listed = propertyLists.get(type);
      const lookup = hasNoMetadataProperty(type, name)
        ? Promise.resolve(undefined)
        : listed !== undefined && isAnsweredByPropertyList(type, name)
          ? listed.then((properties) =>
              properties.find((p) => p.name === name),
            )
          : query(() => type.getProperty(name));
      lookups.set(name, lookup);
      return lookup;
    },
    getPropertiesOfType: (type) => {
      let properties = propertyLists.get(type);
      if (properties === undefined) {
        properties = query(() => type.getProperties());
        propertyLists.set(type, properties);
        properties.catch(() => propertyLists.delete(type));
      }
      return properties;
    },
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
