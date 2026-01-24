import type { TestProject } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    isSnapshotUpdateMode: boolean;
  }
}

export default function setup(project: TestProject): void {
  const hasUpdateFlag =
    process.argv.includes("-u") || process.argv.includes("--update");
  project.provide("isSnapshotUpdateMode", hasUpdateFlag);
}
