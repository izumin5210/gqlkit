import {
  type Diagnostic,
  isEligibleField,
  isTypenameFieldName,
  type PropertyDef,
  type SourceLocation,
} from "../../core/index.js";
import { convertTsTypeToGraphQLType } from "../../shared/index.js";
import type { DefineApiResolverInfo } from "../extractor/define-api-extractor.js";
import type {
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension,
} from "../types.js";

interface ConvertArgsToInputValuesParams {
  readonly args: ReadonlyArray<PropertyDef>;
  readonly resolverLocation: SourceLocation;
  readonly diagnostics: Diagnostic[];
}

/**
 * Arguments get the same name filtering as declared and inline input fields:
 * the downstream auto-type stages derive generated type names from argument
 * names, so a name that is not a valid GraphQL identifier would otherwise
 * leak into both the argument and a generated type name.
 */
function convertArgsToInputValues(
  params: ConvertArgsToInputValuesParams,
): GraphQLInputValue[] {
  const { args, resolverLocation, diagnostics } = params;
  const inputValues: GraphQLInputValue[] = [];

  for (const arg of args) {
    // Typename discrimination fields are silently excluded from the schema
    if (isTypenameFieldName(arg.name)) {
      continue;
    }

    const eligibility = isEligibleField({ fieldName: arg.name, kind: "input" });
    if (!eligibility.eligible) {
      diagnostics.push({
        code: "SKIPPED_FIELD",
        message: eligibility.skipReason.message,
        severity: "warning",
        location: arg.sourceLocation ?? resolverLocation,
      });
      continue;
    }

    inputValues.push({
      name: arg.name,
      type: convertTsTypeToGraphQLType(arg.tsType, arg.optional),
      description: arg.description,
      deprecated: arg.deprecated,
      directives: arg.directives,
      defaultValue: arg.defaultValue,
      tsType: arg.tsType,
    });
  }

  return inputValues;
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
      type: convertTsTypeToGraphQLType(returnType, false),
      args: resolver.args
        ? convertArgsToInputValues({
            args: resolver.args,
            resolverLocation: resolver.sourceLocation,
            diagnostics,
          })
        : null,
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
