import {
  APOLLO_FEDERATION_DIRECTIVES,
  type Diagnostic,
  formatApolloFederationVersion,
  isApolloFederationVersionAtLeast,
  parseApolloFederationUrl,
} from "../core/index.js";
import { makeConfigDiagnostic } from "./diagnostic.js";
import type {
  ResolvedComposeDirectiveLink,
  ResolvedFederationConfig,
} from "./types.js";

export interface ResolveFederationConfigParams {
  readonly value: unknown;
  readonly configPath: string;
}

export interface ResolveFederationConfigResult {
  /** Null when `federation` is absent or invalid; check `diagnostics`. */
  readonly resolved: ResolvedFederationConfig | null;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const DIRECTIVE_IMPORT_PATTERN = /^@[_A-Za-z][_0-9A-Za-z]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ResolveComposeDirectivesParams {
  readonly value: unknown;
  readonly configPath: string;
}

function resolveComposeDirectives(params: ResolveComposeDirectivesParams): {
  readonly resolved: ReadonlyArray<ResolvedComposeDirectiveLink>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
} {
  const { value, configPath } = params;
  const diagnostics: Diagnostic[] = [];
  const invalid = (message: string): void => {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_FEDERATION",
        message,
        configPath,
      }),
    );
  };

  if (value === undefined) {
    return { resolved: [], diagnostics };
  }
  if (!Array.isArray(value)) {
    invalid("federation.composeDirectives must be an array");
    return { resolved: [], diagnostics };
  }

  const resolved: ResolvedComposeDirectiveLink[] = [];
  const seenNames = new Set<string>();
  value.forEach((entry: unknown, index) => {
    const path = `federation.composeDirectives[${index}]`;
    if (!isRecord(entry)) {
      invalid(`${path} must be an object with url and import`);
      return;
    }
    const { url, import: imports } = entry;
    if (typeof url !== "string" || url === "") {
      invalid(`${path}.url must be a non-empty string`);
      return;
    }
    if (
      !Array.isArray(imports) ||
      imports.length === 0 ||
      !imports.every(
        (name): name is string =>
          typeof name === "string" && DIRECTIVE_IMPORT_PATTERN.test(name),
      )
    ) {
      invalid(
        `${path}.import must be a non-empty array of directive names such as "@redact"`,
      );
      return;
    }
    for (const name of imports) {
      if (seenNames.has(name)) {
        invalid(
          `'${name}' is imported more than once in federation.composeDirectives`,
        );
        return;
      }
      seenNames.add(name);
    }
    resolved.push({
      url,
      directiveNames: imports.map((name) => name.slice(1)),
    });
  });

  return { resolved, diagnostics };
}

/**
 * Validates `federation` and resolves the federation version from its spec
 * URL, so that later stages can check which federation features the
 * subgraph may use.
 */
export function resolveFederationConfig(
  params: ResolveFederationConfigParams,
): ResolveFederationConfigResult {
  const { value, configPath } = params;
  const diagnostics: Diagnostic[] = [];
  const invalid = (message: string): void => {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_FEDERATION",
        message,
        configPath,
      }),
    );
  };

  if (value === undefined) {
    return { resolved: null, diagnostics };
  }
  if (!isRecord(value)) {
    invalid("federation must be an object");
    return { resolved: null, diagnostics };
  }

  if (value["spec"] !== "apollo-federation") {
    invalid(
      `federation.spec must be "apollo-federation", but got ${JSON.stringify(value["spec"])}`,
    );
  }

  const url = value["url"];
  const version =
    typeof url === "string" ? parseApolloFederationUrl(url) : null;
  if (typeof url !== "string" || version === null || version.major !== 2) {
    invalid(
      `federation.url must be an Apollo Federation v2 spec URL such as "https://specs.apollo.dev/federation/v2.9", but got ${JSON.stringify(url)}`,
    );
  }

  const composeDirectives = resolveComposeDirectives({
    value: value["composeDirectives"],
    configPath,
  });
  diagnostics.push(...composeDirectives.diagnostics);

  const required = APOLLO_FEDERATION_DIRECTIVES.composeDirective.since;
  if (
    version !== null &&
    composeDirectives.resolved.length > 0 &&
    !isApolloFederationVersionAtLeast(version, required)
  ) {
    invalid(
      `federation.composeDirectives requires federation ${formatApolloFederationVersion(required)} or later, but federation.url links ${formatApolloFederationVersion(version)}`,
    );
  }

  if (diagnostics.length > 0 || typeof url !== "string" || version === null) {
    return { resolved: null, diagnostics };
  }

  return {
    resolved: {
      spec: "apollo-federation",
      url,
      version,
      composeDirectives: composeDirectives.resolved,
    },
    diagnostics,
  };
}
