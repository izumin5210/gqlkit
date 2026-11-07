import type * as ts from "../core/typescript.js";

/**
 * Checker methods whose single-argument calls are memoized. Each call is an
 * IPC round trip to the tsc process, and extraction asks the same questions
 * about the same types and symbols many times over. A program never changes
 * after creation, and the API client interns `Type`, `Symbol` and node
 * objects, so object identity is a sound cache key for these queries.
 */
const MEMOIZED_METHODS = new Set<string | symbol>([
  "getAliasedSymbol",
  "getApparentType",
  "getDeclaredTypeOfSymbol",
  "getDocumentationCommentOfSymbol",
  "getSymbolAtLocation",
  "getTypeArguments",
  "getTypeOfSymbol",
  "isArrayType",
  "isTupleType",
  "typeToString",
]);

function memoizeSingleArgument(
  fn: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
  const cache = new WeakMap<object, unknown>();
  return (...args) => {
    const [key] = args;
    // Extra arguments (e.g. typeToString's enclosing declaration and flags)
    // and array overloads change the answer; leave those uncached.
    if (args.length !== 1 || typeof key !== "object" || key === null) {
      return fn(...args);
    }
    if (Array.isArray(key)) {
      return fn(...args);
    }
    if (cache.has(key)) {
      return cache.get(key);
    }
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
}

function createCachedChecker(checker: ts.Checker): ts.Checker {
  const memoized = new Map<string | symbol, (...args: unknown[]) => unknown>();
  return new Proxy(checker, {
    get(target, property) {
      // The client defines checker methods as getters that close over the
      // real instance, so they must be read from `target`, not the proxy.
      const value: unknown = Reflect.get(target, property, target);
      if (!MEMOIZED_METHODS.has(property) || typeof value !== "function") {
        return value;
      }
      let fn = memoized.get(property);
      if (fn === undefined) {
        fn = memoizeSingleArgument(value as (...args: unknown[]) => unknown);
        memoized.set(property, fn);
      }
      return fn;
    },
  });
}

const cachedCheckers = new WeakMap<ts.Checker, ts.Checker>();

/**
 * Returns the program's checker wrapped so repeated single-argument queries
 * are answered locally. Every stage gets the same wrapper for a program, so
 * the caches are shared across the whole pipeline.
 */
export function getCachedChecker(program: ts.Program): ts.Checker {
  const checker = program.getProject().checker;
  let cached = cachedCheckers.get(checker);
  if (cached === undefined) {
    cached = createCachedChecker(checker);
    cachedCheckers.set(checker, cached);
  }
  return cached;
}
