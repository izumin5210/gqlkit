import {
  type Diagnostic,
  isEligibleField,
  type PropertyDef,
} from "../../core/index.js";
import { convertTsTypeToGraphQLType } from "../../shared/index.js";
import type { DefineApiResolverInfo } from "../extractor/define-api-extractor.js";
import type {
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension,
} from "../types.js";

function convertArgsToInputValues(
  args: ReadonlyArray<PropertyDef>,
): GraphQLInputValue[] {
  return args.map((arg) => ({
    name: arg.name,
    type: convertTsTypeToGraphQLType(arg.tsType, arg.optional),
    description: arg.description,
    deprecated: arg.deprecated,
    directives: arg.directives,
    defaultValue: arg.defaultValue,
    tsType: arg.tsType,
  }));
}

export function convertDefineApiToFields(
  resolvers: ReadonlyArray<DefineApiResolverInfo>,
): {
  queryFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  mutationFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  subscriptionFields: { fields: ReadonlyArray<GraphQLFieldDefinition> };
  typeExtensions: ReadonlyArray<TypeExtension>;
  diagnostics: ReadonlyArray<Diagnostic>;
} {
  const queryFields: GraphQLFieldDefinition[] = [];
  const mutationFields: GraphQLFieldDefinition[] = [];
  const subscriptionFields: GraphQLFieldDefinition[] = [];
  const typeExtensionMap = new Map<string, GraphQLFieldDefinition[]>();
  const diagnostics: Diagnostic[] = [];

  for (const resolver of resolvers) {
    const eligibility = isEligibleField({
      fieldName: resolver.fieldName,
      kind: "object",
    });
    if (!eligibility.eligible) {
      diagnostics.push({
        code: "SKIPPED_FIELD",
        message: eligibility.skipReason.message,
        severity: "warning",
        location: {
          file: resolver.sourceLocation.file,
          line: resolver.sourceLocation.line,
          column: resolver.sourceLocation.column,
        },
      });
      continue;
    }

    const returnType = resolver.returnType;
    const fieldDef: GraphQLFieldDefinition = {
      name: resolver.fieldName,
      type: convertTsTypeToGraphQLType(returnType),
      args: resolver.args ? convertArgsToInputValues(resolver.args) : null,
      sourceLocation: resolver.sourceLocation,
      resolverExportName: resolver.resolverExportName,
      description: resolver.description,
      deprecated: resolver.deprecated,
      directives: resolver.directives,
      returnTsType: returnType,
    };

    if (resolver.resolverType === "query") {
      queryFields.push(fieldDef);
    } else if (resolver.resolverType === "mutation") {
      mutationFields.push(fieldDef);
    } else if (resolver.resolverType === "subscription") {
      subscriptionFields.push(fieldDef);
    } else if (resolver.resolverType === "field" && resolver.parentTypeName) {
      const existing = typeExtensionMap.get(resolver.parentTypeName) ?? [];
      existing.push(fieldDef);
      typeExtensionMap.set(resolver.parentTypeName, existing);
    }
  }

  const typeExtensions: TypeExtension[] = [];
  for (const [targetTypeName, fields] of typeExtensionMap) {
    typeExtensions.push({ targetTypeName, fields });
  }

  return {
    queryFields: { fields: queryFields },
    mutationFields: { fields: mutationFields },
    subscriptionFields: { fields: subscriptionFields },
    typeExtensions,
    diagnostics,
  };
}
