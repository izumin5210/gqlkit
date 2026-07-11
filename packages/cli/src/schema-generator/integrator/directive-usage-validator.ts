/**
 * Validates `@directive` usage across the three contexts that can carry
 * directives: declared types/fields, type-extension fields, and
 * type-extension field arguments. Each usage must reference a defined
 * directive, use a supported location, and be compatible with where it's
 * applied.
 */

import type { Diagnostic, GraphQLTypeInfo } from "../../core/index.js";
import type {
  DirectiveDefinitionInfo,
  DirectiveLocation,
} from "../../shared/directive-definition-extractor.js";
import type { IntegratedTypeExtension } from "./type-extensions.js";

const UNSUPPORTED_LOCATIONS: ReadonlySet<DirectiveLocation> = new Set([
  "SCHEMA",
  "SCALAR",
  "INTERFACE",
  "UNION",
  "ENUM",
]);

type UsageLocation =
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION";

interface DirectiveUsageContext {
  readonly directiveName: string;
  readonly usageLocation: UsageLocation;
  readonly targetName: string;
  readonly sourceFile: string;
  readonly line: number;
}

function validateDirectiveUsage(
  context: DirectiveUsageContext,
  directiveDefMap: Map<string, DirectiveDefinitionInfo>,
  diagnostics: Diagnostic[],
): void {
  const { directiveName, usageLocation, targetName, sourceFile, line } =
    context;

  const def = directiveDefMap.get(directiveName);
  if (!def) {
    diagnostics.push({
      code: "UNDEFINED_DIRECTIVE",
      message: `${targetName}: Directive '@${directiveName}' is not defined`,
      severity: "error",
      location: { file: sourceFile, line, column: 1 },
    });
    return;
  }

  for (const loc of def.locations) {
    if (UNSUPPORTED_LOCATIONS.has(loc)) {
      diagnostics.push({
        code: "UNSUPPORTED_DIRECTIVE_LOCATION",
        message: `${targetName}: Directive '@${directiveName}' uses unsupported location ${loc}`,
        severity: "error",
        location: { file: sourceFile, line, column: 1 },
      });
      return;
    }
  }

  const allowedLocations = getCompatibleLocations(usageLocation);
  const hasValidLocation = def.locations.some((loc) =>
    allowedLocations.includes(loc),
  );

  if (!hasValidLocation) {
    diagnostics.push({
      code: "INVALID_DIRECTIVE_LOCATION",
      message: `${targetName}: Directive '@${directiveName}' cannot be used on ${usageLocation} (allowed: ${def.locations.join(", ")})`,
      severity: "error",
      location: { file: sourceFile, line, column: 1 },
    });
  }
}

function getCompatibleLocations(
  usageLocation: UsageLocation,
): DirectiveLocation[] {
  switch (usageLocation) {
    case "OBJECT":
      return ["OBJECT"];
    case "FIELD_DEFINITION":
      return ["FIELD_DEFINITION"];
    case "INPUT_OBJECT":
      return ["INPUT_OBJECT"];
    case "INPUT_FIELD_DEFINITION":
      return ["INPUT_FIELD_DEFINITION"];
    case "ARGUMENT_DEFINITION":
      return ["ARGUMENT_DEFINITION"];
  }
}

export interface ValidateDirectiveUsagesParams {
  readonly types: ReadonlyArray<GraphQLTypeInfo>;
  readonly typeExtensions: ReadonlyArray<IntegratedTypeExtension>;
  readonly directiveDefinitions: ReadonlyArray<DirectiveDefinitionInfo> | null;
  /**
   * Names of types that back a directive definition's TS type alias — these
   * are skipped since they're metadata-only and never became schema types.
   */
  readonly directiveTypeAliasNames: ReadonlySet<string>;
}

export function validateDirectiveUsages(
  params: ValidateDirectiveUsagesParams,
): ReadonlyArray<Diagnostic> {
  const {
    types,
    typeExtensions,
    directiveDefinitions,
    directiveTypeAliasNames,
  } = params;

  const diagnostics: Diagnostic[] = [];

  const directiveDefMap = new Map<string, DirectiveDefinitionInfo>();
  for (const def of directiveDefinitions ?? []) {
    directiveDefMap.set(def.name, def);
  }

  for (const type of types) {
    if (directiveTypeAliasNames.has(type.name)) {
      continue;
    }

    const usageLocation: UsageLocation =
      type.kind === "InputObject" || type.kind === "OneOfInputObject"
        ? "INPUT_OBJECT"
        : "OBJECT";

    if (type.directives) {
      for (const directive of type.directives) {
        validateDirectiveUsage(
          {
            directiveName: directive.name,
            usageLocation,
            targetName: `Type '${type.name}'`,
            sourceFile: type.sourceFile,
            line: 1,
          },
          directiveDefMap,
          diagnostics,
        );
      }
    }

    const fieldUsageLocation: UsageLocation =
      type.kind === "InputObject" || type.kind === "OneOfInputObject"
        ? "INPUT_FIELD_DEFINITION"
        : "FIELD_DEFINITION";

    for (const field of type.fields ?? []) {
      if (field.directives) {
        for (const directive of field.directives) {
          validateDirectiveUsage(
            {
              directiveName: directive.name,
              usageLocation: fieldUsageLocation,
              targetName: `Field '${type.name}.${field.name}'`,
              sourceFile: type.sourceFile,
              line: 1,
            },
            directiveDefMap,
            diagnostics,
          );
        }
      }
    }
  }

  for (const ext of typeExtensions) {
    for (const field of ext.fields) {
      if (field.directives) {
        for (const directive of field.directives) {
          validateDirectiveUsage(
            {
              directiveName: directive.name,
              usageLocation: "FIELD_DEFINITION",
              targetName: `Field '${ext.targetTypeName}.${field.name}'`,
              sourceFile: field.resolverSourceFile,
              line: 1,
            },
            directiveDefMap,
            diagnostics,
          );
        }
      }

      for (const arg of field.args ?? []) {
        if (arg.directives) {
          for (const directive of arg.directives) {
            validateDirectiveUsage(
              {
                directiveName: directive.name,
                usageLocation: "ARGUMENT_DEFINITION",
                targetName: `Argument '${ext.targetTypeName}.${field.name}(${arg.name}:)'`,
                sourceFile: field.resolverSourceFile,
                line: 1,
              },
              directiveDefMap,
              diagnostics,
            );
          }
        }
      }
    }
  }

  return diagnostics;
}
