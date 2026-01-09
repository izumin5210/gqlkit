import type {
  DirectiveArgumentValue,
  DirectiveInfo,
} from "../shared/directive-detector.js";
import type { DeprecationInfo } from "../shared/tsdoc-parser.js";
import type {
  Diagnostics,
  GraphQLFieldType,
  InlineObjectPropertyDef,
  SourceLocation,
} from "../type-extractor/types/index.js";

export interface GraphQLInputValue {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly defaultValue: DirectiveArgumentValue | null;
  readonly inlineObjectProperties: ReadonlyArray<InlineObjectPropertyDef> | null;
}

export interface GraphQLFieldDefinition {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args: ReadonlyArray<GraphQLInputValue> | null;
  readonly sourceLocation: SourceLocation;
  readonly resolverExportName: string | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
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
