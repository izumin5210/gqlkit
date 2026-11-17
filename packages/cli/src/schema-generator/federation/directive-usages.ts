import {
  type FieldNode,
  GraphQLError,
  Kind,
  parse,
  type SelectionSetNode,
} from "graphql";
import type { ResolvedFederationConfig } from "../../config-loader/index.js";
import {
  APOLLO_FEDERATION_DIRECTIVES,
  type ApolloFederationDirectiveName,
  type Diagnostic,
  type DirectiveInfo,
  type FederationDirectiveKind,
} from "../../core/index.js";
import type { AbstractResolverInfo } from "../../resolver-extractor/index.js";
import type { IntegratedResult } from "../integrator/result-integrator.js";

type UsageLocation =
  | "OBJECT"
  | "INTERFACE"
  | "FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION"
  | "INPUT_FIELD_DEFINITION";

interface FederationDirectiveUsage {
  readonly kind: FederationDirectiveKind;
  readonly directive: DirectiveInfo;
  readonly location: UsageLocation;
  /** Describes the target in diagnostics, e.g. `Field 'User.name'`. */
  readonly targetName: string;
  /** The object or interface type the directive is on or under. */
  readonly typeName: string;
  readonly sourceFile: string | null;
}

interface CollectUsagesParams {
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
  readonly location: UsageLocation;
  readonly targetName: string;
  readonly typeName: string;
  readonly sourceFile: string | null;
  readonly usages: FederationDirectiveUsage[];
}

function collectUsages(params: CollectUsagesParams): void {
  for (const directive of params.directives ?? []) {
    if (directive.federation !== null) {
      params.usages.push({
        kind: directive.federation,
        directive,
        location: params.location,
        targetName: params.targetName,
        typeName: params.typeName,
        sourceFile: params.sourceFile,
      });
    }
  }
}

function collectFederationDirectiveUsages(
  integratedResult: IntegratedResult,
): FederationDirectiveUsage[] {
  const usages: FederationDirectiveUsage[] = [];

  for (const type of integratedResult.baseTypes) {
    if (type.kind !== "Object" && type.kind !== "Interface") {
      continue;
    }
    collectUsages({
      directives: type.directives,
      location: type.kind === "Object" ? "OBJECT" : "INTERFACE",
      targetName: `Type '${type.name}'`,
      typeName: type.name,
      sourceFile: type.sourceFile,
      usages,
    });
    for (const field of type.fields ?? []) {
      collectUsages({
        directives: field.directives,
        location: "FIELD_DEFINITION",
        targetName: `Field '${type.name}.${field.name}'`,
        typeName: type.name,
        sourceFile: type.sourceFile,
        usages,
      });
    }
  }

  for (const type of integratedResult.inputTypes) {
    for (const field of type.fields) {
      collectUsages({
        directives: field.directives,
        location: "INPUT_FIELD_DEFINITION",
        targetName: `Field '${type.name}.${field.name}'`,
        typeName: type.name,
        sourceFile: type.sourceFile,
        usages,
      });
    }
  }

  for (const extension of integratedResult.typeExtensions) {
    for (const field of extension.fields) {
      const fieldName = `${extension.targetTypeName}.${field.name}`;
      collectUsages({
        directives: field.directives,
        location: "FIELD_DEFINITION",
        targetName: `Field '${fieldName}'`,
        typeName: extension.targetTypeName,
        sourceFile: field.resolverSourceFile,
        usages,
      });
      for (const arg of field.args ?? []) {
        collectUsages({
          directives: arg.directives,
          location: "ARGUMENT_DEFINITION",
          targetName: `Argument '${fieldName}(${arg.name}:)'`,
          typeName: extension.targetTypeName,
          sourceFile: field.resolverSourceFile,
          usages,
        });
      }
    }
  }

  return usages;
}

interface OutputFieldInfo {
  readonly typeName: string;
  readonly hasArguments: boolean;
}

interface OutputTypeInfo {
  readonly kind: "Object" | "Interface" | "Union" | "Enum";
  readonly fields: ReadonlyMap<string, OutputFieldInfo>;
}

/** Output types with the fields of both their declarations and resolvers. */
function indexOutputTypes(
  integratedResult: IntegratedResult,
): ReadonlyMap<string, OutputTypeInfo> {
  const fieldsByType = new Map<string, Map<string, OutputFieldInfo>>();
  const fieldsOf = (typeName: string): Map<string, OutputFieldInfo> => {
    let fields = fieldsByType.get(typeName);
    if (fields === undefined) {
      fields = new Map();
      fieldsByType.set(typeName, fields);
    }
    return fields;
  };

  for (const type of integratedResult.baseTypes) {
    for (const field of type.fields ?? []) {
      fieldsOf(type.name).set(field.name, {
        typeName: field.type.typeName,
        hasArguments: false,
      });
    }
  }
  for (const extension of integratedResult.typeExtensions) {
    for (const field of extension.fields) {
      fieldsOf(extension.targetTypeName).set(field.name, {
        typeName: field.type.typeName,
        hasArguments: (field.args?.length ?? 0) > 0,
      });
    }
  }

  return new Map(
    integratedResult.baseTypes.map((type) => [
      type.name,
      { kind: type.kind, fields: fieldsOf(type.name) },
    ]),
  );
}

interface CheckSelectionSetParams {
  readonly selectionSet: SelectionSetNode;
  readonly typeName: string;
  readonly types: ReadonlyMap<string, OutputTypeInfo>;
  readonly problems: string[];
}

function checkKeyField(
  field: FieldNode,
  params: CheckSelectionSetParams,
): void {
  const { typeName, types, problems } = params;
  const name = field.name.value;
  if (field.alias !== undefined) {
    problems.push(`'${field.alias.value}: ${name}' uses an alias`);
    return;
  }
  if ((field.arguments?.length ?? 0) > 0) {
    problems.push(`'${name}' passes arguments`);
    return;
  }
  if ((field.directives?.length ?? 0) > 0) {
    problems.push(`'${name}' has directives`);
    return;
  }

  const fieldInfo = types.get(typeName)?.fields.get(name);
  if (fieldInfo === undefined) {
    problems.push(`'${typeName}' has no field '${name}'`);
    return;
  }
  const qualifiedName = `${typeName}.${name}`;
  if (fieldInfo.hasArguments) {
    problems.push(`'${qualifiedName}' takes arguments`);
    return;
  }

  const fieldType = types.get(fieldInfo.typeName);
  if (fieldType?.kind === "Union" || fieldType?.kind === "Interface") {
    problems.push(
      `'${qualifiedName}' returns the abstract type '${fieldInfo.typeName}'`,
    );
    return;
  }
  const isComposite = fieldType?.kind === "Object";
  if (isComposite && field.selectionSet === undefined) {
    problems.push(
      `'${qualifiedName}' returns the object type '${fieldInfo.typeName}' and needs a selection of its fields`,
    );
    return;
  }
  if (!isComposite && field.selectionSet !== undefined) {
    problems.push(
      `'${qualifiedName}' returns the leaf type '${fieldInfo.typeName}' and cannot have a selection`,
    );
    return;
  }
  if (field.selectionSet !== undefined) {
    checkKeySelectionSet({
      ...params,
      selectionSet: field.selectionSet,
      typeName: fieldInfo.typeName,
    });
  }
}

function checkKeySelectionSet(params: CheckSelectionSetParams): void {
  for (const selection of params.selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      checkKeyField(selection, params);
    } else {
      params.problems.push("fragments are not allowed");
    }
  }
}

/**
 * Checks a key's `fields` against the type it is declared on, so that a key
 * that names a missing field fails generation instead of composition.
 */
function checkKeyFields(
  fields: string,
  typeName: string,
  types: ReadonlyMap<string, OutputTypeInfo>,
): string[] {
  let selectionSet: SelectionSetNode;
  try {
    const document = parse(`{${fields}}`, { noLocation: true });
    const operation = document.definitions[0];
    if (
      document.definitions.length !== 1 ||
      operation?.kind !== Kind.OPERATION_DEFINITION
    ) {
      return ["it is not a selection set"];
    }
    selectionSet = operation.selectionSet;
  } catch (error) {
    if (error instanceof GraphQLError) {
      return [`it is not a selection set (${error.message})`];
    }
    throw error;
  }

  const problems: string[] = [];
  checkKeySelectionSet({ selectionSet, typeName, types, problems });
  return problems;
}

function isResolvableKey(usage: FederationDirectiveUsage): boolean {
  const value = usage.directive.args.find(
    (arg) => arg.name === "resolvable",
  )?.value;
  return !(value?.kind === "boolean" && !value.value);
}

function topLevelKeyFields(fields: string): ReadonlySet<string> {
  const operation = parse(`{${fields}}`, { noLocation: true }).definitions[0];
  const names = new Set<string>();
  if (operation?.kind === Kind.OPERATION_DEFINITION) {
    for (const selection of operation.selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        names.add(selection.name.value);
      }
    }
  }
  return names;
}

interface ValidateReferenceResolversParams {
  readonly integratedResult: IntegratedResult;
  readonly referenceResolvers: ReadonlyArray<AbstractResolverInfo>;
  readonly resolvableKeys: ReadonlyMap<string, Array<ReadonlySet<string>>>;
}

/**
 * Checks that reference resolvers target entities the gateway can resolve
 * through this subgraph, and that an entity has one whenever the fields of
 * its references cannot stand in for the entity.
 */
function validateReferenceResolvers(
  params: ValidateReferenceResolversParams,
): Diagnostic[] {
  const { integratedResult, referenceResolvers, resolvableKeys } = params;
  const diagnostics: Diagnostic[] = [];

  const typeNames = new Set(integratedResult.baseTypes.map((t) => t.name));
  for (const resolver of referenceResolvers) {
    // An unknown target is reported as UNKNOWN_ABSTRACT_TYPE already.
    if (
      typeNames.has(resolver.targetTypeName) &&
      !resolvableKeys.has(resolver.targetTypeName)
    ) {
      diagnostics.push({
        code: "INVALID_REFERENCE_RESOLVER_TARGET",
        message: `Reference resolver '${resolver.exportName}' targets '${resolver.targetTypeName}', which has no resolvable @key in this subgraph`,
        severity: "error",
        location: resolver.sourceLocation,
      });
    }
  }

  const typesWithResolver = new Set(
    referenceResolvers.map((resolver) => resolver.targetTypeName),
  );
  for (const type of integratedResult.baseTypes) {
    const keys = resolvableKeys.get(type.name);
    if (keys === undefined || typesWithResolver.has(type.name)) {
      continue;
    }
    // A reference carries the fields of any one of the keys, so only the
    // fields every key has are certain to be there.
    const missingFields = (type.fields ?? [])
      .map((field) => field.name)
      .filter((name) => !keys.every((key) => key.has(name)));
    if (missingFields.length > 0) {
      diagnostics.push({
        code: "MISSING_REFERENCE_RESOLVER",
        message: `Entity '${type.name}' has fields that its references do not carry (${missingFields.join(", ")}), but no reference resolver. Define one with defineResolveReference<${type.name}>.`,
        severity: "error",
        location:
          type.sourceFile === null
            ? null
            : { file: type.sourceFile, line: 1, column: 1 },
      });
    }
  }

  return diagnostics;
}

function keyFieldsArgument(directive: DirectiveInfo): string | null {
  const value = directive.args.find((arg) => arg.name === "fields")?.value;
  return value?.kind === "string" || value?.kind === "enum"
    ? value.value
    : null;
}

export interface AnalyzeFederationDirectivesParams {
  readonly federation: ResolvedFederationConfig | null;
  readonly integratedResult: IntegratedResult;
}

export interface AnalyzeFederationDirectivesResult {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  /** Federation directives to import into the schema, sorted by name. */
  readonly imports: ReadonlyArray<ApolloFederationDirectiveName>;
  /**
   * Types declared as entities. The gateway reaches them through entity
   * resolution, so pruning must keep them even when no root field does.
   */
  readonly entityTypeNames: ReadonlyArray<string>;
}

/**
 * Validates the uses of `@gqlkit-ts/runtime/federation` directives against
 * the federation spec, and derives what the subgraph schema must import.
 */
export function analyzeFederationDirectives(
  params: AnalyzeFederationDirectivesParams,
): AnalyzeFederationDirectivesResult {
  const { federation, integratedResult } = params;
  const usages = collectFederationDirectiveUsages(integratedResult);
  const diagnostics: Diagnostic[] = [];
  const location = (usage: FederationDirectiveUsage) =>
    usage.sourceFile === null
      ? null
      : { file: usage.sourceFile, line: 1, column: 1 };

  const referenceResolvers = integratedResult.abstractTypeResolvers.filter(
    (resolver) => resolver.kind === "resolveReference",
  );

  if (federation === null) {
    for (const usage of usages) {
      diagnostics.push({
        code: "FEDERATION_NOT_CONFIGURED",
        message: `${usage.targetName}: Federation directive '@${usage.directive.name}' requires the federation config`,
        severity: "error",
        location: location(usage),
      });
    }
    for (const resolver of referenceResolvers) {
      diagnostics.push({
        code: "FEDERATION_NOT_CONFIGURED",
        message: `Reference resolver '${resolver.exportName}' for type '${resolver.targetTypeName}' requires the federation config`,
        severity: "error",
        location: resolver.sourceLocation,
      });
    }
    return { diagnostics, imports: [], entityTypeNames: [] };
  }

  const types = indexOutputTypes(integratedResult);
  const imports = new Set<ApolloFederationDirectiveName>();
  const entityTypeNames = new Set<string>();
  /** Top-level fields of each resolvable key, by entity type. */
  const resolvableKeys = new Map<string, Array<ReadonlySet<string>>>();

  for (const usage of usages) {
    const spec = APOLLO_FEDERATION_DIRECTIVES[usage.kind];
    imports.add(usage.kind);
    if (!spec.locations.includes(usage.location)) {
      diagnostics.push({
        code: "INVALID_DIRECTIVE_LOCATION",
        message: `${usage.targetName}: Directive '@${spec.name}' cannot be used on ${usage.location} (allowed: ${spec.locations.join(", ")})`,
        severity: "error",
        location: location(usage),
      });
      continue;
    }
    if (usage.kind !== "key") {
      continue;
    }
    entityTypeNames.add(usage.typeName);
    const fields = keyFieldsArgument(usage.directive);
    const problems =
      fields === null
        ? ["the fields argument must be a string literal"]
        : checkKeyFields(fields, usage.typeName, types);
    for (const problem of problems) {
      diagnostics.push({
        code: "INVALID_KEY_FIELDS",
        message: `${usage.targetName}: @key(fields: ${JSON.stringify(fields)}) is invalid: ${problem}`,
        severity: "error",
        location: location(usage),
      });
    }
    if (fields !== null && problems.length === 0 && isResolvableKey(usage)) {
      const keys = resolvableKeys.get(usage.typeName) ?? [];
      keys.push(topLevelKeyFields(fields));
      resolvableKeys.set(usage.typeName, keys);
    }
  }

  diagnostics.push(
    ...validateReferenceResolvers({
      integratedResult,
      referenceResolvers,
      resolvableKeys,
    }),
  );

  if (federation.composeDirectives.length > 0) {
    imports.add("composeDirective");
  }

  return {
    diagnostics,
    imports: [...imports].sort(),
    entityTypeNames: [...entityTypeNames].sort(),
  };
}
