import type { TestProject } from "vitest/node";
import { provideSnapshotUpdateMode } from "./src/testing/snapshot.js";

export default function setup(project: TestProject): void {
  provideSnapshotUpdateMode(project);
}
