export type {
  FieldInfo,
  GraphQLFieldType,
  GraphQLTypeInfo,
  GraphQLTypeKind,
} from "../core/index.js";
export type { CollectedTypesResult } from "./collector/result-collector.js";
export {
  type CollectedScalarType,
  type ConfigScalarMapping,
  type DescriptionSource,
  mergeDescriptions,
  type ScalarMetadataInfo,
} from "./collector/scalar-collector.js";
export { convertToGraphQL } from "./converter/graphql-converter.js";
export {
  type ExtractTypesParams,
  type ExtractTypesResult,
  extractTypes,
} from "./extract-types.js";
// Shared type-resolution engine (refactor-plan.md §3.2): resolver-extractor
// consumes this as a declared dependency of the facade, not a deep import.
export {
  type FieldTypeResolverContext,
  resolveFieldType,
} from "./extractor/field-type-resolver.js";
export type { GlobalTypeMapping } from "./extractor/type-extractor.js";
export {
  collectDeclaredTypeNames,
  type TypeNameCollectionResult,
} from "./extractor/type-name-collector.js";
export type { ScalarBaseTypeMappingTable } from "./mapper/scalar-base-type-mapper.js";

export type {
  ExtractedTypeInfo,
  FieldDefinition,
} from "./types/index.js";
