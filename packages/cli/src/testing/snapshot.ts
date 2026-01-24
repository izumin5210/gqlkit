import { inject } from "vitest";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    isSnapshotUpdateMode: boolean;
  }
}

export function provideSnapshotUpdateMode(project: TestProject): void {
  const hasUpdateFlag =
    process.argv.includes("-u") || process.argv.includes("--update");
  project.provide("isSnapshotUpdateMode", hasUpdateFlag);
}

export function isSnapshotUpdateMode(): boolean {
  return inject("isSnapshotUpdateMode");
}
