import { Worker } from "node:worker_threads";
import type { ExtractDefineApiResult } from "../../resolver-extractor/index.js";
import type {
  ResolverWorkerData,
  ResolverWorkerRequest,
  ResolverWorkerResponse,
} from "./protocol.js";

export interface ResolverWorker {
  /**
   * Hands the worker the results of type extraction and waits for the
   * resolver definitions; null if the worker could not create the program.
   */
  readonly extract: (
    request: ResolverWorkerRequest,
  ) => Promise<ExtractDefineApiResult | null>;
  /** Stops the worker if it is still running. */
  readonly terminate: () => Promise<void>;
}

export interface StartResolverWorkerParams {
  /** The compiled `worker.js` module. */
  readonly url: URL;
  readonly data: ResolverWorkerData;
}

export function startResolverWorker(
  params: StartResolverWorkerParams,
): ResolverWorker {
  const worker = new Worker(params.url, { workerData: params.data });
  const response = new Promise<ExtractDefineApiResult | null>(
    (resolve, reject) => {
      worker.once("message", (message: ResolverWorkerResponse) => {
        if (message.kind === "definitions") {
          resolve(message.definitions);
        } else {
          reject(message.error);
        }
      });
      worker.once("error", reject);
      worker.once("exit", (code) => {
        reject(new Error(`resolver worker exited with code ${code}`));
      });
    },
  );
  // `extract` observes the failure; a pipeline that stops before resolver
  // extraction never asks.
  response.catch(() => {});

  return {
    extract: (request) => {
      worker.postMessage(request);
      return response;
    },
    terminate: async () => {
      await worker.terminate();
    },
  };
}
