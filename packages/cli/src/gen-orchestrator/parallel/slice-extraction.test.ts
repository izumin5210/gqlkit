import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  listGoldenCaseNames,
  loadGoldenCase,
} from "../../testing/golden-cases.js";
import {
  executeGenerationWithOptions,
  type GenerationOptions,
} from "../orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testdataDir = join(__dirname, "../testdata");

// Runs the worker from source, as the tests run everything else.
const sliceWorker: GenerationOptions["sliceWorker"] = {
  url: new URL("./worker.ts", import.meta.url),
  execArgv: ["--import", "tsx"],
};

const missingWorker = new URL("./missing-worker.ts", import.meta.url);

const failingWorker = new URL(
  `data:text/javascript,${encodeURIComponent(`
    import { parentPort } from "node:worker_threads";
    parentPort.postMessage({ kind: "ready" });
    parentPort.postMessage({ kind: "error", error: new Error("worker failed") });
  `)}`,
);

describe.concurrent("extraction split into ranges of files", async () => {
  const caseNames = await listGoldenCaseNames(testdataDir);

  for (const caseName of caseNames) {
    it(`${caseName} gives the result of extracting in sequence`, async () => {
      const { generationConfig } = await loadGoldenCase({
        testdataDir,
        name: caseName,
      });

      const sequential = await executeGenerationWithOptions(generationConfig, {
        slices: 1,
        sliceWorker,
      });
      // One range per file: every file is extracted before the files
      // preceding it are.
      const split = await executeGenerationWithOptions(generationConfig, {
        slices: Number.MAX_SAFE_INTEGER,
        sliceWorker,
      });

      expect(split).toEqual(sequential);

      // Workers that cannot start leave their ranges to the main thread.
      const unstarted = await executeGenerationWithOptions(generationConfig, {
        slices: Number.MAX_SAFE_INTEGER,
        sliceWorker: { ...sliceWorker, url: missingWorker },
      });
      expect(unstarted).toEqual(sequential);
    });
  }

  it("reports the error of a worker that fails after starting", async () => {
    const { generationConfig } = await loadGoldenCase({
      testdataDir,
      name: "abstract-resolver-mixed",
    });

    await expect(
      executeGenerationWithOptions(generationConfig, {
        slices: Number.MAX_SAFE_INTEGER,
        sliceWorker: { url: failingWorker, execArgv: [] },
      }),
    ).rejects.toThrow("worker failed");
  });
});
