import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleFile = fileURLToPath(import.meta.url);

/**
 * `packages/cli`, whether this module runs from `src/testing/bench` (tsx) or
 * from its compiled copy in `dist/testing/bench`.
 */
export const PACKAGE_ROOT = resolve(moduleFile, "../../../..");

/** Golden cases are only in `src`; `tsc` does not copy them to `dist`. */
export const TESTDATA_DIR = join(PACKAGE_ROOT, "src/gen-orchestrator/testdata");

/** Golden cases import `@gqlkit-ts/runtime`, which resolves to its build. */
export const RUNTIME_TYPES_PATH = join(
  PACKAGE_ROOT,
  "../runtime/dist/index.d.ts",
);

/** Resolves a sibling module with this module's extension (`.ts` or `.js`). */
export function siblingModulePath(basename: string): string {
  return join(moduleFile, "..", `${basename}${extname(moduleFile)}`);
}

/**
 * Resolves a user-supplied path against the directory the command was run
 * from: pnpm runs package scripts in the package directory but keeps the
 * original one in `INIT_CWD`.
 */
export function resolveUserPath(path: string): string {
  return resolve(process.env["INIT_CWD"] ?? process.cwd(), path);
}
