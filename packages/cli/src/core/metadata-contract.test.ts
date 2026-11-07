/**
 * Contract test between `METADATA_PROPERTIES` (this package) and the
 * space-prefixed marker properties embedded in `@gqlkit-ts/runtime`'s type
 * definitions.
 *
 * WHY this test exists: the CLI detects gqlkit runtime types by shape,
 * not by name, via these marker properties (e.g. `" $gqlkitScalar"`).
 * The runtime package embeds the very same string literals directly in its
 * exported type definitions (`packages/runtime/src/*.ts`). There is no
 * compile-time link between the two packages for this contract -- it is
 * purely string-based -- so renaming a marker on either side silently
 * breaks type detection at generation time without any type error. This
 * test reads the runtime source as plain text and cross-checks both
 * directions so such a drift fails loudly in CI instead of at runtime.
 *
 * The runtime package's `index.ts` used to be a single 875-line file
 * mixing every marker-bearing type; it has since been split by concern
 * (`directive.ts`, `field.ts`, `interface.ts`, `object.ts`, `resolver.ts`,
 * `scalar.ts`, `apis.ts`) with `index.ts` reduced to a barrel re-export.
 * This test therefore scans every non-test `.ts` file directly under
 * `packages/runtime/src` rather than a single known path.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { METADATA_PROPERTIES } from "./metadata-contract.js";

const RUNTIME_SRC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../runtime/src",
);

/**
 * Marker-looking literals that exist in the runtime source but are
 * intentionally NOT registered in `METADATA_PROPERTIES`.
 *
 * `METADATA_PROPERTIES` must only contain markers the CLI actually reads,
 * so known one-sided runtime literals are allowlisted here instead of
 * being registered.
 *
 * Empty today: the previous entry, `" $gqlkitInterface"` (a required inner
 * property of `GqlInterfaceMetaShape` introduced in PR #27, never read by
 * the CLI), was removed from the runtime source by
 * .kiro/specs/refactor-plan.md's Phase 9 runtime-cleanup item -- the
 * self-clean assertion below caught the now-stale allowlist entry, per its
 * own design. The machinery is kept in place for future one-sided runtime
 * literals.
 */
const KNOWN_UNREGISTERED_RUNTIME_MARKERS: ReadonlySet<string> = new Set([]);

function listRuntimeSourceFiles(): string[] {
  return fs
    .readdirSync(RUNTIME_SRC_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => path.join(RUNTIME_SRC_DIR, name));
}

function readRuntimeSource(): string {
  return listRuntimeSourceFiles()
    .map((filePath) => fs.readFileSync(filePath, "utf-8"))
    .join("\n");
}

/** Matches space-prefixed marker-looking property literals, e.g. `" $gqlkitScalar"`. */
const MARKER_LITERAL_PATTERN = /"( \$[A-Za-z]+)"/g;

function extractMarkerLiteralsFromSource(source: string): ReadonlySet<string> {
  const markers = new Set<string>();
  for (const match of source.matchAll(MARKER_LITERAL_PATTERN)) {
    markers.add(match[1]!);
  }
  return markers;
}

describe("METADATA_PROPERTIES <-> runtime marker contract", () => {
  it("every METADATA_PROPERTIES value appears verbatim in the runtime source", () => {
    const runtimeSource = readRuntimeSource();

    for (const [key, value] of Object.entries(METADATA_PROPERTIES)) {
      expect(
        runtimeSource.includes(`"${value}"`),
        `METADATA_PROPERTIES.${key} (${JSON.stringify(value)}) was not found as a quoted literal anywhere under ${RUNTIME_SRC_DIR}`,
      ).toBe(true);
    }
  });

  it("every space-prefixed marker literal in the runtime source is registered in METADATA_PROPERTIES", () => {
    const runtimeSource = readRuntimeSource();
    const runtimeMarkers = extractMarkerLiteralsFromSource(runtimeSource);
    const registeredMarkers = new Set<string>(
      Object.values(METADATA_PROPERTIES),
    );

    for (const marker of runtimeMarkers) {
      if (KNOWN_UNREGISTERED_RUNTIME_MARKERS.has(marker)) {
        continue;
      }
      expect(
        registeredMarkers.has(marker),
        `Found marker-like property ${JSON.stringify(marker)} under ${RUNTIME_SRC_DIR} that is not registered in METADATA_PROPERTIES. Either it's a new gqlkit marker missing a CLI-side entry, or it's dead runtime code that must be explicitly allowlisted in KNOWN_UNREGISTERED_RUNTIME_MARKERS.`,
      ).toBe(true);
    }
  });

  it("every allowlisted unregistered marker still exists in the runtime source", () => {
    // Self-cleaning check: when the runtime-cleanup phase removes an
    // allowlisted property, this fails and prompts deleting the stale
    // allowlist entry instead of letting it linger forever.
    const runtimeSource = readRuntimeSource();
    const runtimeMarkers = extractMarkerLiteralsFromSource(runtimeSource);

    for (const marker of KNOWN_UNREGISTERED_RUNTIME_MARKERS) {
      expect(
        runtimeMarkers.has(marker),
        `Allowlisted marker ${JSON.stringify(marker)} no longer exists anywhere under ${RUNTIME_SRC_DIR}. Remove it from KNOWN_UNREGISTERED_RUNTIME_MARKERS.`,
      ).toBe(true);
    }
  });
});
