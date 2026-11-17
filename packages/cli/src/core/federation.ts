import type { FederationDirectiveKind } from "./metadata.js";

/**
 * Knowledge of the Apollo Federation v2 specification that more than one
 * pipeline stage needs: how a spec URL encodes its version, and which
 * federation directives exist in which version along with the definitions a
 * subgraph's executable schema needs for them.
 */

export interface ApolloFederationVersion {
  readonly major: number;
  readonly minor: number;
}

const APOLLO_FEDERATION_URL_PATTERN =
  /^https:\/\/specs\.apollo\.dev\/federation\/v(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Reads the version from an Apollo Federation spec URL such as
 * `https://specs.apollo.dev/federation/v2.9`. Returns null for any other URL.
 */
export function parseApolloFederationUrl(
  url: string,
): ApolloFederationVersion | null {
  const match = APOLLO_FEDERATION_URL_PATTERN.exec(url);
  if (match === null) {
    return null;
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function isApolloFederationVersionAtLeast(
  version: ApolloFederationVersion,
  required: ApolloFederationVersion,
): boolean {
  return (
    version.major > required.major ||
    (version.major === required.major && version.minor >= required.minor)
  );
}

export function formatApolloFederationVersion(
  version: ApolloFederationVersion,
): string {
  return `v${version.major}.${version.minor}`;
}

export type ApolloFederationDirectiveName =
  | "composeDirective"
  | FederationDirectiveKind;

interface VersionedDefinition {
  readonly since: ApolloFederationVersion;
  /** SDL in the form `@apollo/subgraph` prints it. */
  readonly sdl: string;
}

interface ApolloFederationDirectiveSpec {
  readonly name: ApolloFederationDirectiveName;
  /** The first version with the directive. */
  readonly since: ApolloFederationVersion;
  /**
   * Definitions ordered by version. A version uses the last one whose
   * `since` it satisfies.
   */
  readonly definitions: ReadonlyArray<VersionedDefinition>;
  /** Locations gqlkit can apply the directive to. */
  readonly locations: ReadonlyArray<string>;
  /** Arguments whose values are strings even when they look like enum values. */
  readonly stringArguments: ReadonlyArray<string>;
}

/**
 * Federation directives gqlkit can import into a subgraph.
 */
export const APOLLO_FEDERATION_DIRECTIVES: Readonly<
  Record<ApolloFederationDirectiveName, ApolloFederationDirectiveSpec>
> = {
  composeDirective: {
    name: "composeDirective",
    since: { major: 2, minor: 1 },
    definitions: [
      {
        since: { major: 2, minor: 1 },
        sdl: "directive @composeDirective(name: String) repeatable on SCHEMA",
      },
    ],
    locations: ["SCHEMA"],
    stringArguments: ["name"],
  },
  key: {
    name: "key",
    since: { major: 2, minor: 0 },
    definitions: [
      {
        since: { major: 2, minor: 0 },
        sdl: `
directive @key(fields: federation__FieldSet!, resolvable: Boolean = true) repeatable on OBJECT | INTERFACE

scalar federation__FieldSet
`,
      },
    ],
    // gqlkit has no way to attach directives to interfaces.
    locations: ["OBJECT"],
    stringArguments: ["fields"],
  },
  shareable: {
    name: "shareable",
    since: { major: 2, minor: 0 },
    definitions: [
      {
        since: { major: 2, minor: 0 },
        sdl: "directive @shareable on OBJECT | FIELD_DEFINITION",
      },
      {
        since: { major: 2, minor: 2 },
        sdl: "directive @shareable repeatable on OBJECT | FIELD_DEFINITION",
      },
    ],
    locations: ["OBJECT", "FIELD_DEFINITION"],
    stringArguments: [],
  },
  inaccessible: {
    name: "inaccessible",
    since: { major: 2, minor: 0 },
    definitions: [
      {
        since: { major: 2, minor: 0 },
        sdl: "directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION",
      },
    ],
    // The locations gqlkit emits directives on; the spec allows more.
    locations: [
      "OBJECT",
      "FIELD_DEFINITION",
      "ARGUMENT_DEFINITION",
      "INPUT_FIELD_DEFINITION",
    ],
    stringArguments: [],
  },
};

/** The definition of a federation directive as of the given version. */
export function apolloFederationDirectiveDefinition(
  name: ApolloFederationDirectiveName,
  version: ApolloFederationVersion,
): string {
  const { definitions } = APOLLO_FEDERATION_DIRECTIVES[name];
  let definition = definitions[0]!.sdl;
  for (const candidate of definitions) {
    if (isApolloFederationVersionAtLeast(version, candidate.since)) {
      definition = candidate.sdl;
    }
  }
  return definition;
}

const FEDERATION_DIRECTIVE_KINDS: ReadonlySet<string> =
  new Set<FederationDirectiveKind>(["key", "shareable", "inaccessible"]);

export function isFederationDirectiveKind(
  value: string,
): value is FederationDirectiveKind {
  return FEDERATION_DIRECTIVE_KINDS.has(value);
}

/**
 * The `@link` directive and the types it refers to, namespaced with `link__`
 * because a subgraph links the link spec without importing them.
 */
export const LINK_SPEC_DEFINITIONS = `
directive @link(url: String, as: String, for: link__Purpose, import: [link__Import]) repeatable on SCHEMA

scalar link__Import

enum link__Purpose {
  SECURITY
  EXECUTION
}
`;

export const LINK_DIRECTIVE_NAME = "link";
