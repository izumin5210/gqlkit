/**
 * ScalarCollector collects scalar definitions from types and config,
 * validates input/output type constraints, and builds type parameters.
 */

/**
 * Information about a detected scalar type from metadata detection.
 */
export interface ScalarMetadataInfo {
  /** The GraphQL scalar name */
  readonly scalarName: string;
  /** The TypeScript type name */
  readonly typeName: string;
  /** Usage constraint: "input", "output", or null for both */
  readonly only: "input" | "output" | null;
  /** Source file path */
  readonly sourceFile: string;
  /** Line number in source file */
  readonly line: number;
  /** TSDoc description if available */
  readonly description: string | null;
}

/**
 * Configuration scalar mapping information.
 */
export interface ConfigScalarMapping extends ScalarMetadataInfo {
  /** Whether this mapping comes from config file */
  readonly fromConfig: boolean;
}

/**
 * Reference to a scalar type.
 */
export interface ScalarTypeRef {
  /** TypeScript type name */
  readonly typeName: string;
  /** Source file path */
  readonly sourceFile: string;
  /** Line number in source file */
  readonly line: number;
}

/**
 * Description source information.
 */
export interface DescriptionSource {
  /** Description text */
  readonly text: string;
  /** Source file path */
  readonly sourceFile: string;
  /** Line number in source file */
  readonly line: number;
  /** Whether this description comes from config */
  readonly fromConfig: boolean;
}

/**
 * Collected scalar type with input/output type information.
 */
export interface CollectedScalarType {
  /** GraphQL scalar name */
  readonly scalarName: string;
  /** Input type reference (exactly one required) */
  readonly inputType: ScalarTypeRef | null;
  /** Output type references (one or more required, union built from these) */
  readonly outputTypes: ReadonlyArray<ScalarTypeRef>;
  /** Description sources */
  readonly descriptions: ReadonlyArray<DescriptionSource>;
  /** Whether this is a custom scalar (not built-in) */
  readonly isCustom: boolean;
}

/**
 * Diagnostic error information.
 */
export interface ScalarCollectorDiagnostic {
  readonly code:
    | "MULTIPLE_INPUT_TYPES"
    | "MISSING_INPUT_TYPE"
    | "MISSING_OUTPUT_TYPE";
  readonly message: string;
  readonly severity: "error";
}

/**
 * Result type for scalar collection.
 */
export type CollectScalarsResult =
  | { success: true; data: ReadonlyArray<CollectedScalarType> }
  | { success: false; errors: ReadonlyArray<ScalarCollectorDiagnostic> };

/**
 * Built-in GraphQL scalar names that should be excluded from custom scalar collection.
 */
const BUILT_IN_SCALARS = new Set(["ID", "Int", "Float", "String", "Boolean"]);

interface ScalarGroup {
  inputTypes: ScalarTypeRef[];
  outputTypes: ScalarTypeRef[];
  descriptions: DescriptionSource[];
}

function createTypeRef(info: ScalarMetadataInfo): ScalarTypeRef {
  return {
    typeName: info.typeName,
    sourceFile: info.sourceFile,
    line: info.line,
  };
}

function createDescriptionSource(
  info: ScalarMetadataInfo,
  fromConfig: boolean,
): DescriptionSource | null {
  if (!info.description) return null;
  return {
    text: info.description,
    sourceFile: info.sourceFile,
    line: info.line,
    fromConfig,
  };
}

function sortDescriptions(
  descriptions: DescriptionSource[],
): DescriptionSource[] {
  return [...descriptions].sort((a, b) => {
    const fileCompare = a.sourceFile.localeCompare(b.sourceFile);
    if (fileCompare !== 0) return fileCompare;
    return a.line - b.line;
  });
}

/**
 * Merges multiple descriptions into a single string with blank line separators.
 * Descriptions are expected to be pre-sorted by file path alphabetically
 * and by line number within the same file.
 *
 * @param descriptions - Array of description sources to merge
 * @returns Merged description string, or null if no descriptions available
 */
export function mergeDescriptions(
  descriptions: ReadonlyArray<DescriptionSource>,
): string | null {
  if (descriptions.length === 0) {
    return null;
  }
  return descriptions.map((d) => d.text).join("\n\n");
}

function formatTypeLocation(
  ref: ScalarTypeRef,
  sourceRoot: string | null,
): string {
  const filePath =
    sourceRoot !== null
      ? ref.sourceFile.replace(sourceRoot, "").replace(/^[/\\]/, "")
      : ref.sourceFile;
  return `${filePath.replace(/\\/g, "/")}:${ref.line}`;
}

/**
 * Options for scalar collection.
 */
export interface CollectScalarsOptions {
  /** Root path for normalizing source file paths in error messages */
  readonly sourceRoot?: string | null;
}

/**
 * Collects scalar definitions from types and config,
 * validates constraints, and builds type parameters.
 *
 * @param scalarInfos - Scalar metadata from source files
 * @param configScalars - Scalar mappings from config file
 * @param options - Collection options
 * @returns Result with collected scalars or diagnostics
 */
export function collectScalars(
  scalarInfos: ReadonlyArray<ScalarMetadataInfo>,
  configScalars: ReadonlyArray<ConfigScalarMapping>,
  options: CollectScalarsOptions = {},
): CollectScalarsResult {
  const sourceRoot = options.sourceRoot ?? null;
  const scalarGroups = new Map<string, ScalarGroup>();

  const processInfo = (info: ScalarMetadataInfo, fromConfig: boolean): void => {
    if (BUILT_IN_SCALARS.has(info.scalarName)) {
      return;
    }

    let group = scalarGroups.get(info.scalarName);
    if (!group) {
      group = { inputTypes: [], outputTypes: [], descriptions: [] };
      scalarGroups.set(info.scalarName, group);
    }

    const typeRef = createTypeRef(info);

    if (info.only === null || info.only === "input") {
      group.inputTypes.push(typeRef);
    }
    if (info.only === null || info.only === "output") {
      group.outputTypes.push(typeRef);
    }

    const descSource = createDescriptionSource(info, fromConfig);
    if (descSource) {
      group.descriptions.push(descSource);
    }
  };

  for (const info of scalarInfos) {
    processInfo(info, false);
  }
  for (const info of configScalars) {
    processInfo(info, info.fromConfig);
  }

  const diagnostics: ScalarCollectorDiagnostic[] = [];
  const collectedScalars: CollectedScalarType[] = [];

  for (const [scalarName, group] of scalarGroups) {
    if (group.inputTypes.length > 1) {
      const typeLocations = group.inputTypes
        .map((t) => `'${t.typeName}' at ${formatTypeLocation(t, sourceRoot)}`)
        .join(", ");
      diagnostics.push({
        code: "MULTIPLE_INPUT_TYPES",
        message: `Custom scalar '${scalarName}' has multiple input types: ${typeLocations}. Only one input type is allowed per scalar.`,
        severity: "error",
      });
      continue;
    }

    if (group.inputTypes.length === 0) {
      diagnostics.push({
        code: "MISSING_INPUT_TYPE",
        message: `Custom scalar '${scalarName}' has no input type. Add a type without 'only' constraint or with 'only: "input"'.`,
        severity: "error",
      });
      continue;
    }

    if (group.outputTypes.length === 0) {
      diagnostics.push({
        code: "MISSING_OUTPUT_TYPE",
        message: `Custom scalar '${scalarName}' has no output type. Add a type without 'only' constraint or with 'only: "output"'.`,
        severity: "error",
      });
      continue;
    }

    collectedScalars.push({
      scalarName,
      inputType: group.inputTypes[0] ?? null,
      outputTypes: group.outputTypes,
      descriptions: sortDescriptions(group.descriptions),
      isCustom: true,
    });
  }

  if (diagnostics.length > 0) {
    return { success: false, errors: diagnostics };
  }

  return { success: true, data: collectedScalars };
}
