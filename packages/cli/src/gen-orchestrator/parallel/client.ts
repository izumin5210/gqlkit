import { Worker } from "node:worker_threads";
import type {
  SliceWorkerData,
  SliceWorkerRequest,
  SliceWorkerResponse,
} from "./protocol.js";

export type Reply<K extends SliceWorkerResponse["kind"]> = Extract<
  SliceWorkerResponse,
  { kind: K }
>;

/** The main thread's side of a slice worker (see `worker.ts`). */
export interface SliceWorker {
  /** The next message from the worker, which must be of kind `kind`. */
  readonly receive: <
    K extends Exclude<SliceWorkerResponse["kind"], "ready" | "error">,
  >(
    kind: K,
  ) => Promise<Reply<K>>;
  /**
   * Whether the worker loaded. One that failed before, e.g. because the
   * environment cannot run it, did no work and can be done without.
   */
  readonly hasStarted: () => boolean;
  readonly send: (request: SliceWorkerRequest) => void;
  /** Stops the worker if it is still running. */
  readonly terminate: () => Promise<void>;
}

/** Where to load the worker from. */
export interface SliceWorkerModule {
  /** The `worker.js` module. */
  readonly url: URL;
  /** Node.js options for the worker, or null for this process's. */
  readonly execArgv: ReadonlyArray<string> | null;
}

export interface StartSliceWorkerParams {
  readonly module: SliceWorkerModule;
  readonly data: SliceWorkerData;
}

export function startSliceWorker(params: StartSliceWorkerParams): SliceWorker {
  const { module, data } = params;
  const worker = new Worker(module.url, {
    workerData: data,
    ...(module.execArgv === null ? {} : { execArgv: [...module.execArgv] }),
  });
  const received: SliceWorkerResponse[] = [];
  const waiting: Array<(response: SliceWorkerResponse) => void> = [];
  let failure: { readonly error: unknown } | null = null;
  let started = false;
  const deliver = (response: SliceWorkerResponse): void => {
    const next = waiting.shift();
    if (next === undefined) {
      received.push(response);
    } else {
      next(response);
    }
  };
  const fail = (error: unknown): void => {
    failure ??= { error };
    for (const next of waiting.splice(0)) {
      next({ kind: "error", error: failure.error });
    }
  };
  worker.on("message", (response: SliceWorkerResponse) => {
    switch (response.kind) {
      case "ready":
        started = true;
        break;
      case "error":
        fail(response.error);
        break;
      default:
        deliver(response);
    }
  });
  worker.on("error", fail);
  worker.on("exit", (code) => {
    fail(new Error(`slice worker exited with code ${code}`));
  });

  return {
    receive: async (kind) => {
      const response =
        received.shift() ??
        (failure === null
          ? await new Promise<SliceWorkerResponse>((resolve) => {
              waiting.push(resolve);
            })
          : { kind: "error" as const, error: failure.error });
      if (response.kind === "error") {
        throw response.error;
      }
      if (response.kind !== kind) {
        throw new Error(
          `expected a "${kind}" message from the slice worker, got "${response.kind}"`,
        );
      }
      return response as Reply<typeof kind>;
    },
    hasStarted: () => started,
    send: (request) => {
      worker.postMessage(request);
    },
    terminate: async () => {
      await worker.terminate();
    },
  };
}
