import type ts from "typescript";
import type {
  DirectiveArgumentValue,
  DirectiveInfo,
} from "../shared/directive-detector.js";
import type { DeprecationInfo } from "../shared/tsdoc-parser.js";
import type {
  Diagnostics,
  GraphQLFieldType,
  InlineEnumMemberInfo,
  InlineObjectPropertyDef,
  SourceLocation,
} from "../type-extractor/types/index.js";
import type { AbstractResolverInfo } from "./extractor/define-api-extractor.js";

export interface GraphQLInputValue {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly defaultValue: DirectiveArgumentValue | null;
  readonly inlineObjectProperties: ReadonlyArray<InlineObjectPropertyDef> | null;
  /** Inline enum members when arg type is an inline enum (string literal union or external TypeScript enum) */
  readonly inlineEnumMembers: ReadonlyArray<InlineEnumMemberInfo> | null;
  /** External TypeScript enum symbol for deduplication across multiple references */
  readonly externalEnumSymbol: ts.Symbol | null;
  /** TSDoc description from the external enum type itself (null for string literal unions) */
  readonly externalEnumDescription: string | null;
  /** @deprecated tag from the external enum type itself (null for string literal unions) */
  readonly externalEnumDeprecated: DeprecationInfo | null;
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
  readonly abstractTypeResolvers: ReadonlyArray<AbstractResolverInfo>;
  readonly diagnostics: Diagnostics;
}
