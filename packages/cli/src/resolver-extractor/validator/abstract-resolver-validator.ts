/**
 * AbstractResolverValidator validates that abstract type resolvers
 * reference valid types in the schema.
 *
 * - resolveType must reference union or interface types
 * - isTypeOf must reference object types
 */

import type { BaseType } from "../../schema-generator/integrator/result-integrator.js";
import type {
  Diagnostic,
  DiagnosticCode,
} from "../../type-extractor/types/index.js";
import type { AbstractResolverInfo } from "../extractor/define-api-extractor.js";

export interface ValidateAbstractResolversOptions {
  readonly abstractResolvers: ReadonlyArray<AbstractResolverInfo>;
  readonly baseTypes: ReadonlyArray<BaseType>;
}

export interface ValidateAbstractResolversResult {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

function formatTypeKindForDisplay(kind: BaseType["kind"]): string {
  return kind.toLowerCase();
}

/**
 * Formats a list of resolver definitions for error messages.
 */
function formatResolverLocations(
  resolvers: ReadonlyArray<AbstractResolverInfo>,
): string {
  return resolvers
    .map(
      (r) =>
        `  - ${r.exportName} at ${r.sourceLocation.file}:${r.sourceLocation.line}:${r.sourceLocation.column}`,
    )
    .join("\n");
}

function reportDuplicates(
  resolverMap: Map<string, AbstractResolverInfo[]>,
  code: DiagnosticCode,
  kind: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const [typeName, duplicates] of resolverMap) {
    if (duplicates.length > 1) {
      const firstResolver = duplicates[0];
      if (firstResolver) {
        diagnostics.push({
          code,
          message: `Multiple ${kind} definitions found for type '${typeName}':\n${formatResolverLocations(duplicates)}`,
          severity: "error",
          location: firstResolver.sourceLocation,
        });
      }
    }
  }
  return diagnostics;
}

/**
 * Detects duplicate abstract type resolver definitions.
 * Groups resolvers by kind and target type, then reports all duplicates.
 *
 * @param resolvers - All abstract resolvers to check
 * @param typeMap - Map of type names to their definitions (for existence checking)
 * @returns Array of diagnostics for duplicate definitions
 */
function detectDuplicateResolvers(
  resolvers: ReadonlyArray<AbstractResolverInfo>,
  typeMap: Map<string, BaseType>,
): Diagnostic[] {
  const resolveTypeMap = new Map<string, AbstractResolverInfo[]>();
  const isTypeOfMap = new Map<string, AbstractResolverInfo[]>();

  for (const resolver of resolvers) {
    if (!typeMap.has(resolver.targetTypeName)) {
      continue;
    }

    const targetMap =
      resolver.kind === "resolveType" ? resolveTypeMap : isTypeOfMap;
    const existing = targetMap.get(resolver.targetTypeName) ?? [];
    existing.push(resolver);
    targetMap.set(resolver.targetTypeName, existing);
  }

  return [
    ...reportDuplicates(
      resolveTypeMap,
      "DUPLICATE_RESOLVE_TYPE",
      "resolveType",
    ),
    ...reportDuplicates(isTypeOfMap, "DUPLICATE_IS_TYPE_OF", "isTypeOf"),
  ];
}

function createMissingResolverDiagnostic(
  typeName: string,
  typeKind: "Union" | "Interface",
  sourceFile: string | null,
): Diagnostic {
  const memberLabel = typeKind === "Union" ? "member" : "implementing";
  return {
    code: "MISSING_ABSTRACT_TYPE_RESOLVER",
    message: `${typeKind} type '${typeName}' has no resolveType defined, and not all ${memberLabel} types have isTypeOf defined. To prevent runtime errors, either define a resolveType for '${typeName}' or define isTypeOf for each ${memberLabel} type.`,
    severity: "error",
    location: sourceFile ? { file: sourceFile, line: 1, column: 1 } : null,
  };
}

/**
 * Detects abstract types (union/interface) that have no resolveType defined
 * and whose member/implementing types don't all have isTypeOf defined.
 *
 * @param resolvers - All abstract resolvers to check
 * @param typeMap - Map of type names to their definitions
 * @returns Array of warning diagnostics for missing resolvers
 */
function detectMissingAbstractTypeResolvers(
  resolvers: ReadonlyArray<AbstractResolverInfo>,
  typeMap: Map<string, BaseType>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const resolveTypeSet = new Set<string>();
  const isTypeOfSet = new Set<string>();

  for (const resolver of resolvers) {
    if (resolver.kind === "resolveType") {
      resolveTypeSet.add(resolver.targetTypeName);
    } else if (resolver.kind === "isTypeOf") {
      isTypeOfSet.add(resolver.targetTypeName);
    }
  }

  const implementingTypesMap = new Map<string, string[]>();
  for (const [typeName, baseType] of typeMap) {
    if (
      baseType.kind === "Object" &&
      baseType.implementedInterfaces &&
      baseType.implementedInterfaces.length > 0
    ) {
      for (const interfaceName of baseType.implementedInterfaces) {
        const existing = implementingTypesMap.get(interfaceName) ?? [];
        existing.push(typeName);
        implementingTypesMap.set(interfaceName, existing);
      }
    }
  }

  for (const [typeName, baseType] of typeMap) {
    if (baseType.kind !== "Union" && baseType.kind !== "Interface") {
      continue;
    }
    if (resolveTypeSet.has(typeName)) {
      continue;
    }

    const members =
      baseType.kind === "Union"
        ? (baseType.unionMembers ?? [])
        : (implementingTypesMap.get(typeName) ?? []);

    if (members.length === 0) {
      continue;
    }

    const allMembersHaveIsTypeOf = members.every((m) => isTypeOfSet.has(m));
    if (!allMembersHaveIsTypeOf) {
      diagnostics.push(
        createMissingResolverDiagnostic(
          typeName,
          baseType.kind,
          baseType.sourceFile ?? null,
        ),
      );
    }
  }

  return diagnostics;
}

/**
 * Validates abstract type resolvers.
 *
 * @param options - Validation options including abstract resolvers and base types
 * @returns Validation result with diagnostics
 */
export function validateAbstractResolvers(
  options: ValidateAbstractResolversOptions,
): ValidateAbstractResolversResult {
  const diagnostics: Diagnostic[] = [];
  const typeMap = new Map<string, BaseType>();

  for (const baseType of options.baseTypes) {
    typeMap.set(baseType.name, baseType);
  }

  for (const resolver of options.abstractResolvers) {
    const targetType = typeMap.get(resolver.targetTypeName);

    if (!targetType) {
      diagnostics.push({
        code: "UNKNOWN_ABSTRACT_TYPE",
        message: `Type '${resolver.targetTypeName}' does not exist in the schema. The ${resolver.kind} resolver '${resolver.exportName}' references a type that has not been defined.`,
        severity: "error",
        location: resolver.sourceLocation,
      });
      continue;
    }

    if (resolver.kind === "resolveType") {
      if (targetType.kind !== "Union" && targetType.kind !== "Interface") {
        diagnostics.push({
          code: "INVALID_ABSTRACT_TYPE_KIND",
          message: `Type '${resolver.targetTypeName}' is ${formatTypeKindForDisplay(targetType.kind)} type, but resolveType can only be used with union or interface types. The resolver '${resolver.exportName}' must reference an abstract type.`,
          severity: "error",
          location: resolver.sourceLocation,
        });
      }
    } else if (resolver.kind === "isTypeOf") {
      if (targetType.kind !== "Object") {
        diagnostics.push({
          code: "INVALID_OBJECT_TYPE_KIND",
          message: `Type '${resolver.targetTypeName}' is ${formatTypeKindForDisplay(targetType.kind)} type, but isTypeOf can only be used with object types. The resolver '${resolver.exportName}' must reference an object type.`,
          severity: "error",
          location: resolver.sourceLocation,
        });
      }
    }
  }

  const duplicateDiagnostics = detectDuplicateResolvers(
    options.abstractResolvers,
    typeMap,
  );
  diagnostics.push(...duplicateDiagnostics);

  const missingResolverWarnings = detectMissingAbstractTypeResolvers(
    options.abstractResolvers,
    typeMap,
  );
  diagnostics.push(...missingResolverWarnings);

  return { diagnostics };
}
