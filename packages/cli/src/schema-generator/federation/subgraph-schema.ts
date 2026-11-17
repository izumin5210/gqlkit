import {
  type ConstDirectiveNode,
  type ConstValueNode,
  type DefinitionNode,
  type DocumentNode,
  Kind,
  parse,
  type SchemaExtensionNode,
} from "graphql";
import type { ResolvedFederationConfig } from "../../config-loader/index.js";
import {
  APOLLO_FEDERATION_DIRECTIVES,
  type Diagnostic,
  LINK_DIRECTIVE_NAME,
  LINK_SPEC_DEFINITIONS,
} from "../../core/index.js";
import type { DirectiveDefinitionInfo } from "../../shared/directive-definition-extractor.js";

type ApolloFederationDirectiveName = keyof typeof APOLLO_FEDERATION_DIRECTIVES;

/** Federation directives the subgraph imports, sorted by name. */
function collectFederationImports(
  federation: ResolvedFederationConfig,
): ApolloFederationDirectiveName[] {
  const names: ApolloFederationDirectiveName[] = [];
  if (federation.composeDirectives.length > 0) {
    names.push("composeDirective");
  }
  return names.sort();
}

function stringValue(value: string): ConstValueNode {
  return { kind: Kind.STRING, value };
}

function buildDirective(
  name: string,
  args: ReadonlyArray<readonly [string, ConstValueNode]>,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    name: { kind: Kind.NAME, value: name },
    arguments: args.map(([argName, value]) => ({
      kind: Kind.ARGUMENT,
      name: { kind: Kind.NAME, value: argName },
      value,
    })),
  };
}

function buildLinkDirective(
  url: string,
  directiveNames: ReadonlyArray<string>,
): ConstDirectiveNode {
  const args: Array<readonly [string, ConstValueNode]> = [
    ["url", stringValue(url)],
  ];
  if (directiveNames.length > 0) {
    args.push([
      "import",
      {
        kind: Kind.LIST,
        values: directiveNames.map((name) => stringValue(`@${name}`)),
      },
    ]);
  }
  return buildDirective(LINK_DIRECTIVE_NAME, args);
}

function buildSchemaExtension(
  federation: ResolvedFederationConfig,
  imports: ReadonlyArray<string>,
): SchemaExtensionNode {
  const composedLinks = federation.composeDirectives.map((link) =>
    buildLinkDirective(link.url, link.directiveNames),
  );
  const composeDirectives = federation.composeDirectives.flatMap((link) =>
    link.directiveNames.map((name) =>
      buildDirective(APOLLO_FEDERATION_DIRECTIVES.composeDirective.name, [
        ["name", stringValue(`@${name}`)],
      ]),
    ),
  );
  return {
    kind: Kind.SCHEMA_EXTENSION,
    directives: [
      buildLinkDirective(federation.url, imports),
      ...composedLinks,
      ...composeDirectives,
    ],
  };
}

/** `parse` fills absent lists with `[]`, which gqlkit's own nodes omit. */
function omitEmptyLists<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(omitEmptyLists) as T;
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => [k, omitEmptyLists(v)]),
  ) as T;
}

/**
 * Definitions of the directives the schema extension applies. They are left
 * out of the SDL handed to composition, which knows them from the linked
 * specs, but graphql-js needs them to build the executable schema.
 */
function buildRuntimeDefinitions(
  imports: ReadonlyArray<ApolloFederationDirectiveName>,
): ReadonlyArray<DefinitionNode> {
  const sdl = [
    LINK_SPEC_DEFINITIONS,
    ...imports.map((name) => APOLLO_FEDERATION_DIRECTIVES[name].definition),
  ].join("\n");
  return omitEmptyLists(parse(sdl, { noLocation: true }).definitions);
}

export interface BuildSubgraphDocumentsParams {
  readonly documentNode: DocumentNode;
  readonly federation: ResolvedFederationConfig;
}

export interface BuildSubgraphDocumentsResult {
  /** The subgraph SDL for composition, also served as `_service.sdl`. */
  readonly sdlDocument: DocumentNode;
  /** The SDL plus the definitions graphql-js needs to execute it. */
  readonly typeDefsDocument: DocumentNode;
}

export function buildSubgraphDocuments(
  params: BuildSubgraphDocumentsParams,
): BuildSubgraphDocumentsResult {
  const { documentNode, federation } = params;
  const imports = collectFederationImports(federation);

  const sdlDocument: DocumentNode = {
    ...documentNode,
    definitions: [
      buildSchemaExtension(federation, imports),
      ...documentNode.definitions,
    ],
  };
  const typeDefsDocument: DocumentNode = {
    ...sdlDocument,
    definitions: [
      ...sdlDocument.definitions,
      ...buildRuntimeDefinitions(imports),
    ],
  };
  return { sdlDocument, typeDefsDocument };
}

export interface ValidateFederationDirectivesParams {
  readonly federation: ResolvedFederationConfig;
  readonly directiveDefinitions: ReadonlyArray<DirectiveDefinitionInfo> | null;
}

/**
 * Checks the user's directive definitions against what federation adds to
 * the schema: every directive kept with `@composeDirective` must be defined,
 * and none may take the name of a directive gqlkit defines for federation.
 */
export function validateFederationDirectives(
  params: ValidateFederationDirectivesParams,
): Diagnostic[] {
  const { federation, directiveDefinitions } = params;
  const diagnostics: Diagnostic[] = [];
  const definedNames = new Set(directiveDefinitions?.map((d) => d.name));

  for (const link of federation.composeDirectives) {
    for (const name of link.directiveNames) {
      if (!definedNames.has(name)) {
        diagnostics.push({
          code: "UNDEFINED_COMPOSE_DIRECTIVE",
          message: `federation.composeDirectives imports '@${name}', but no exported GqlDirective defines it`,
          severity: "error",
          location: null,
        });
      }
    }
  }

  const reservedNames = new Set<string>([
    LINK_DIRECTIVE_NAME,
    ...collectFederationImports(federation),
  ]);
  for (const definition of directiveDefinitions ?? []) {
    if (reservedNames.has(definition.name)) {
      diagnostics.push({
        code: "FEDERATION_DIRECTIVE_NAME_CONFLICT",
        message: `Directive '@${definition.name}' has the same name as a directive that federation adds to the subgraph schema`,
        severity: "error",
        location: {
          file: definition.sourceFile,
          line: definition.line,
          column: 1,
        },
      });
    }
  }

  return diagnostics;
}
