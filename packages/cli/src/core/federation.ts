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

interface ApolloFederationDirectiveSpec {
  readonly name: string;
  readonly since: ApolloFederationVersion;
  /** The definition as of `since`, in the form `@apollo/subgraph` prints it. */
  readonly definition: string;
}

/**
 * Federation directives gqlkit can import into a subgraph. A directive is
 * listed once, with the definition from the version it appeared in, until a
 * later version changes that definition.
 */
export const APOLLO_FEDERATION_DIRECTIVES = {
  composeDirective: {
    name: "composeDirective",
    since: { major: 2, minor: 1 },
    definition:
      "directive @composeDirective(name: String) repeatable on SCHEMA",
  },
} as const satisfies Record<string, ApolloFederationDirectiveSpec>;

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
