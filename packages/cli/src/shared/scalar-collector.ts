/**
 * Scalar collector.
 *
 * This module collects scalar definitions from detected metadata and config,
 * builds input/output type parameters, and validates constraints.
 */

import type { Diagnostic } from "../type-extractor/types/index.js";
import type { ScalarMetadataInfo } from "./scalar-metadata-detector.js";

const BUILTIN_SCALARS = new Set(["ID", "Int", "Float", "String", "Boolean"]);

/**
 * Configuration for scalar mapping from config file.
 */
export interface ConfigScalarMapping {
  readonly name: string;
  readonly tsType: {
    readonly name: string;
    readonly from?: string;
  };
  readonly only?: "input" | "output";
  readonly description?: string;
}

/**
 * Reference to a TypeScript type used for scalar mapping.
 */
export interface ScalarTypeRef {
  readonly typeName: string;
  readonly sourceFile: string | null;
  readonly line: number | null;
}

/**
 * Source of a description for a scalar.
 */
export interface DescriptionSource {
  readonly text: string;
  readonly sourceFile: string | null;
  readonly line: number | null;
  readonly fromConfig: boolean;
}

/**
 * Collected scalar type with input/output type information.
 */
export interface CollectedScalarType {
  readonly scalarName: string;
  readonly inputType: ScalarTypeRef | null;
  readonly outputTypes: ReadonlyArray<ScalarTypeRef>;
  readonly descriptions: ReadonlyArray<DescriptionSource>;
  readonly isCustom: boolean;
}

/**
 * Result type for operations that can fail.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

interface ScalarEntry {
  readonly typeName: string;
  readonly sourceFile: string | null;
  readonly line: number | null;
  readonly only: "input" | "output" | null;
  readonly description: string | null;
  readonly fromConfig: boolean;
}

interface ScalarGroup {
  scalarName: string;
  entries: ScalarEntry[];
}

function createTypeRef(entry: ScalarEntry): ScalarTypeRef {
  return {
    typeName: entry.typeName,
    sourceFile: entry.sourceFile,
    line: entry.line,
  };
}

function formatLocation(entry: ScalarEntry): string {
  if (entry.sourceFile && entry.line) {
    return `${entry.typeName} (${entry.sourceFile}:${entry.line})`;
  }
  if (entry.sourceFile) {
    return `${entry.typeName} (${entry.sourceFile})`;
  }
  return entry.typeName;
}

function validateInputTypes(
  scalarName: string,
  entries: ScalarEntry[],
): Diagnostic | null {
  const inputOnlyEntries = entries.filter((e) => e.only === "input");
  const noOnlyEntries = entries.filter((e) => e.only === null);

  const inputCandidates = [...inputOnlyEntries, ...noOnlyEntries];

  if (inputCandidates.length > 1) {
    const locations = inputCandidates.map(formatLocation).join(", ");
    return {
      code: "MULTIPLE_INPUT_TYPES",
      message: `Scalar "${scalarName}" has multiple input type mappings: ${locations}. Only one input type is allowed per scalar (either with only: "input" or without only constraint).`,
      severity: "error",
      location: null,
    };
  }

  return null;
}

function validateCompleteness(
  scalarName: string,
  entries: ScalarEntry[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const inputOnlyEntries = entries.filter((e) => e.only === "input");
  const outputOnlyEntries = entries.filter((e) => e.only === "output");
  const noOnlyEntries = entries.filter((e) => e.only === null);

  const hasInputType = inputOnlyEntries.length > 0 || noOnlyEntries.length > 0;
  const hasOutputType =
    outputOnlyEntries.length > 0 || noOnlyEntries.length > 0;

  if (!hasInputType) {
    diagnostics.push({
      code: "MISSING_INPUT_TYPE",
      message: `Scalar "${scalarName}" is missing an input type mapping. Add a type with only: "input" or without only constraint.`,
      severity: "error",
      location: null,
    });
  }

  if (!hasOutputType) {
    diagnostics.push({
      code: "MISSING_OUTPUT_TYPE",
      message: `Scalar "${scalarName}" is missing an output type mapping. Add a type with only: "output" or without only constraint.`,
      severity: "error",
      location: null,
    });
  }

  return diagnostics;
}

function buildCollectedScalar(
  scalarName: string,
  entries: ScalarEntry[],
): CollectedScalarType {
  const inputOnlyEntries = entries.filter((e) => e.only === "input");
  const outputOnlyEntries = entries.filter((e) => e.only === "output");
  const noOnlyEntries = entries.filter((e) => e.only === null);

  let inputType: ScalarTypeRef | null = null;
  if (inputOnlyEntries.length > 0) {
    inputType = createTypeRef(inputOnlyEntries[0]!);
  } else if (noOnlyEntries.length > 0) {
    inputType = createTypeRef(noOnlyEntries[0]!);
  }

  const outputTypes: ScalarTypeRef[] = [];
  for (const entry of noOnlyEntries) {
    outputTypes.push(createTypeRef(entry));
  }
  for (const entry of outputOnlyEntries) {
    outputTypes.push(createTypeRef(entry));
  }

  const descriptions: DescriptionSource[] = [];
  for (const entry of entries) {
    if (entry.description) {
      descriptions.push({
        text: entry.description,
        sourceFile: entry.sourceFile,
        line: entry.line,
        fromConfig: entry.fromConfig,
      });
    }
  }

  return {
    scalarName,
    inputType,
    outputTypes,
    descriptions,
    isCustom: true,
  };
}

/**
 * Collects and merges descriptions for a scalar.
 * Returns null if no descriptions are available.
 *
 * Sort order: file path alphabetically, then by line number within the same file.
 * Config descriptions (with null sourceFile) are sorted after source file descriptions.
 *
 * @param descriptionSources - Array of description sources
 * @returns Merged description string or null
 */
export function collectDescription(
  descriptionSources: ReadonlyArray<DescriptionSource>,
): string | null {
  if (descriptionSources.length === 0) {
    return null;
  }

  const sorted = [...descriptionSources].sort((a, b) => {
    const fileA = a.sourceFile ?? "";
    const fileB = b.sourceFile ?? "";

    const fileCompare = fileA.localeCompare(fileB);
    if (fileCompare !== 0) {
      return fileCompare;
    }

    const lineA = a.line ?? 0;
    const lineB = b.line ?? 0;
    return lineA - lineB;
  });

  return sorted.map((s) => s.text).join("\n\n");
}

/**
 * Collects scalar definitions from metadata and config,
 * validates constraints, and builds input/output type parameters.
 *
 * @param scalarInfos - Scalar metadata detected from source files
 * @param configScalars - Scalar mappings from config file
 * @returns Result with collected scalars or validation errors
 */
export function collectScalars(
  scalarInfos: ReadonlyArray<ScalarMetadataInfo>,
  configScalars: ReadonlyArray<ConfigScalarMapping>,
): Result<ReadonlyArray<CollectedScalarType>, ReadonlyArray<Diagnostic>> {
  const groupMap = new Map<string, ScalarGroup>();

  for (const info of scalarInfos) {
    if (BUILTIN_SCALARS.has(info.scalarName)) {
      continue;
    }

    if (!info.typeName) {
      continue;
    }

    let group = groupMap.get(info.scalarName);
    if (!group) {
      group = { scalarName: info.scalarName, entries: [] };
      groupMap.set(info.scalarName, group);
    }

    group.entries.push({
      typeName: info.typeName,
      sourceFile: info.sourceFile,
      line: info.line,
      only: info.only,
      description: info.description,
      fromConfig: false,
    });
  }

  for (const config of configScalars) {
    if (BUILTIN_SCALARS.has(config.name)) {
      continue;
    }

    let group = groupMap.get(config.name);
    if (!group) {
      group = { scalarName: config.name, entries: [] };
      groupMap.set(config.name, group);
    }

    group.entries.push({
      typeName: config.tsType.name,
      sourceFile: config.tsType.from ?? null,
      line: null,
      only: config.only ?? null,
      description: config.description ?? null,
      fromConfig: true,
    });
  }

  const diagnostics: Diagnostic[] = [];
  const collectedScalars: CollectedScalarType[] = [];

  const sortedNames = [...groupMap.keys()].sort();
  for (const scalarName of sortedNames) {
    const group = groupMap.get(scalarName)!;

    const inputError = validateInputTypes(scalarName, group.entries);
    if (inputError) {
      diagnostics.push(inputError);
      continue;
    }

    const completenessErrors = validateCompleteness(scalarName, group.entries);
    if (completenessErrors.length > 0) {
      diagnostics.push(...completenessErrors);
      continue;
    }

    collectedScalars.push(buildCollectedScalar(scalarName, group.entries));
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: collectedScalars };
}
