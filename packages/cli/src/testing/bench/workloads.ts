import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadConfig } from "../../config-loader/index.js";
import {
  DEFAULT_IMPORT_EXTENSION,
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_SOURCE_DIR,
  DEFAULT_TYPEDEFS_PATH,
} from "../../config-loader/types.js";
import type {
  GenerationConfig,
  GenerationResult,
} from "../../gen-orchestrator/orchestrator.js";
import { listGoldenCaseNames, loadGoldenCase } from "../golden-cases.js";
import { EXAMPLES_DIR, SYNTHETIC_DIR, TESTDATA_DIR } from "./paths.js";
import { writeSyntheticProject } from "./synthetic.js";
import { findErrorDiagnostics, findGoldenMismatches } from "./verify.js";

/**
 * - golden: every golden case; tiny projects where per-run fixed costs
 *   dominate, with byte-exact expected output.
 * - examples: the repository's example apps; realistic, mid-sized.
 * - synthetic: a generated project large enough for per-type work to
 *   dominate.
 */
export type WorkloadGroup = "golden" | "examples" | "synthetic";

export const WORKLOAD_GROUPS: ReadonlyArray<WorkloadGroup> = [
  "golden",
  "examples",
  "synthetic",
];

export interface Workload {
  /** `<group>/<id>`, unique across groups. */
  readonly name: string;
  readonly group: WorkloadGroup;
  readonly generationConfig: GenerationConfig;
  /** Describes what is wrong with a result; empty when it is acceptable. */
  readonly check: (result: GenerationResult) => Promise<string[]>;
}

async function loadGoldenWorkload(caseName: string): Promise<Workload> {
  const goldenCase = await loadGoldenCase({
    testdataDir: TESTDATA_DIR,
    name: caseName,
  });
  return {
    name: `golden/${caseName}`,
    group: "golden",
    generationConfig: goldenCase.generationConfig,
    check: (result) => findGoldenMismatches(goldenCase, result),
  };
}

/**
 * Example outputs are committed after an `afterAllFileWrite` formatter hook,
 * so they cannot be compared byte for byte; any error diagnostic fails them.
 */
async function loadExampleWorkload(exampleName: string): Promise<Workload> {
  const cwd = join(EXAMPLES_DIR, exampleName);
  const loaded = await loadConfig({ cwd, configPath: null });
  if (loaded.diagnostics.length > 0) {
    throw new Error(
      `failed to load the config of examples/${exampleName}: ${loaded.diagnostics.map((d) => d.message).join("; ")}`,
    );
  }
  const { config } = loaded;
  return {
    name: `examples/${exampleName}`,
    group: "examples",
    generationConfig: {
      cwd,
      sourceDir: config.sourceDir,
      sourceIgnoreGlobs: config.sourceIgnoreGlobs,
      output: config.output,
      configDir: loaded.configPath === null ? cwd : dirname(loaded.configPath),
      customScalars: config.scalars,
      tsconfigPath: config.tsconfigPath,
      discriminatorFields: config.discriminatorFields,
    },
    check: async (result) => findErrorDiagnostics(result),
  };
}

const SYNTHETIC_NAME_PATTERN = /^synthetic\/domains-(\d+)$/;

function syntheticWorkload(domains: number): Workload {
  return {
    name: `synthetic/domains-${domains}`,
    group: "synthetic",
    generationConfig: {
      cwd: SYNTHETIC_DIR,
      sourceDir: DEFAULT_SOURCE_DIR,
      sourceIgnoreGlobs: [],
      output: {
        resolversPath: DEFAULT_RESOLVERS_PATH,
        typeDefsPath: DEFAULT_TYPEDEFS_PATH,
        schemaPath: DEFAULT_SCHEMA_PATH,
        importExtension: DEFAULT_IMPORT_EXTENSION,
        pruning: true,
      },
      configDir: null,
      customScalars: null,
      tsconfigPath: join(SYNTHETIC_DIR, "tsconfig.json"),
      discriminatorFields: new Map(),
    },
    check: async (result) => findErrorDiagnostics(result),
  };
}

async function listExampleNames(): Promise<string[]> {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true });
  return entries
    .filter(
      (e) =>
        e.isDirectory() && existsSync(join(EXAMPLES_DIR, e.name, "src/gqlkit")),
    )
    .map((e) => e.name)
    .sort();
}

interface PrepareWorkloadsParams {
  readonly groups: ReadonlySet<WorkloadGroup>;
  readonly syntheticDomains: number;
}

/** Loads the selected workloads, (re)generating the synthetic project. */
export async function prepareWorkloads(
  params: PrepareWorkloadsParams,
): Promise<Workload[]> {
  const { groups, syntheticDomains } = params;
  const workloads: Workload[] = [];
  if (groups.has("golden")) {
    for (const name of await listGoldenCaseNames(TESTDATA_DIR)) {
      workloads.push(await loadGoldenWorkload(name));
    }
  }
  if (groups.has("examples")) {
    for (const name of await listExampleNames()) {
      workloads.push(await loadExampleWorkload(name));
    }
  }
  if (groups.has("synthetic")) {
    await writeSyntheticProject({
      dir: SYNTHETIC_DIR,
      domains: syntheticDomains,
    });
    workloads.push(syntheticWorkload(syntheticDomains));
  }
  return workloads;
}

/**
 * Loads one workload by name, for per-process child runs. The synthetic
 * project must already have been written by `prepareWorkloads`.
 */
export async function loadWorkload(name: string): Promise<Workload> {
  const [group, id] = name.split(/\/(.*)/s);
  if (id === undefined) {
    throw new Error(`invalid workload name "${name}"`);
  }
  switch (group) {
    case "golden":
      return loadGoldenWorkload(id);
    case "examples":
      return loadExampleWorkload(id);
    case "synthetic": {
      const match = SYNTHETIC_NAME_PATTERN.exec(name);
      if (match === null) {
        throw new Error(`invalid synthetic workload name "${name}"`);
      }
      return syntheticWorkload(Number(match[1]));
    }
    default:
      throw new Error(`unknown workload group in "${name}"`);
  }
}
