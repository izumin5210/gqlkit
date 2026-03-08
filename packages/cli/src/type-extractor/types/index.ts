export type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
export type {
  Diagnostic,
  DiagnosticCode,
  Diagnostics,
  SourceLocation,
} from "./diagnostics.js";
export type {
  EnumValueInfo,
  FieldInfo,
  GraphQLFieldType,
  GraphQLTypeInfo,
  GraphQLTypeKind,
} from "./graphql.js";
export {
  createArrayType,
  createInlineObjectType,
  createNumericLiteralType,
  createPrimitiveType,
  createReferenceType,
  createScalarType,
  createStringLiteralType,
  createUnionType,
} from "./ts-type-reference-factory.js";
export type {
  EnumMemberInfo,
  ExtractedTypeInfo,
  FieldDefinition,
  InlineEnumMemberInfo,
  InlineObjectMember,
  InlineObjectProperty,
  InlineObjectPropertyDef,
  ScalarTypeInfo,
  TSTypeReference,
  TSTypeReferenceKind,
  TypeKind,
  TypeMetadata,
} from "./typescript.js";
