import type { DeprecationInfo } from "../shared/tsdoc-parser.js";
import type {
  Diagnostics,
  GraphQLFieldType,
  SourceLocation,
} from "../type-extractor/types/index.js";

export interface GraphQLInputValue {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface GraphQLFieldDefinition {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args: ReadonlyArray<GraphQLInputValue> | null;
  readonly sourceLocation: SourceLocation;
  readonly resolverExportName: string | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface QueryFieldDefinitions {
  readonly fields: ReadonlyArray<GraphQLFieldDefinition>;
}

export interface MutationFieldDefinitions {
  readonly fields: ReadonlyArray<GraphQLFieldDefinition>;
}

export interface TypeExtension {
  readonly targetTypeName: string;
  readonly fields: ReadonlyArray<GraphQLFieldDefinition>;
}

export interface ExtractResolversResult {
  readonly queryFields: QueryFieldDefinitions;
  readonly mutationFields: MutationFieldDefinitions;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  readonly diagnostics: Diagnostics;
}
