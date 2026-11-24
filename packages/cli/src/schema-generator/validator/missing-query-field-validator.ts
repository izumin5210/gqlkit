import type { Diagnostic } from "../../core/index.js";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import type { IntegratedTypeExtension } from "../integrator/type-extensions.js";

export interface ValidateMissingQueryFieldParams {
  readonly resolversResult: ExtractResolversResult;
  readonly typeExtensions: ReadonlyArray<IntegratedTypeExtension>;
  /**
   * Federation subgraphs get their Query root fields (_service, _entities)
   * from the federation layer, so a subgraph without its own queries is
   * complete as-is.
   */
  readonly federationEnabled: boolean;
}

export interface ValidateMissingQueryFieldResult {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * GraphQL requires the Query root type to define one or more fields. A
 * project that defines only mutations and/or subscriptions still gets an
 * empty `type Query` in the generated schema, which graphql-js rejects.
 *
 * This is a warning, not an error: the schema may be merged with another
 * schema that provides the queries before it is served. Projects with no
 * root operation fields at all emit no root types either, so there is
 * nothing misleading to warn about.
 */
export function validateMissingQueryField(
  params: ValidateMissingQueryFieldParams,
): ValidateMissingQueryFieldResult {
  const { resolversResult, typeExtensions, federationEnabled } = params;

  if (federationEnabled) {
    return { diagnostics: [] };
  }

  const extensionFieldsFor = (rootTypeName: string): number =>
    typeExtensions
      .filter((extension) => extension.targetTypeName === rootTypeName)
      .reduce((count, extension) => count + extension.fields.length, 0);

  const queryFieldCount =
    resolversResult.queryFields.fields.length + extensionFieldsFor("Query");
  if (queryFieldCount > 0) {
    return { diagnostics: [] };
  }

  const otherRootFieldCount =
    resolversResult.mutationFields.fields.length +
    resolversResult.subscriptionFields.fields.length +
    extensionFieldsFor("Mutation") +
    extensionFieldsFor("Subscription");
  if (otherRootFieldCount === 0) {
    return { diagnostics: [] };
  }

  return {
    diagnostics: [
      {
        code: "MISSING_QUERY_FIELD",
        message:
          "The schema has no query fields, but GraphQL requires the Query root type to define one or more fields. Add at least one defineQuery resolver.",
        severity: "warning",
        location: null,
      },
    ],
  };
}
