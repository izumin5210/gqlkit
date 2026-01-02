import { pruneSchema } from "@graphql-tools/utils";
import {
  buildASTSchema,
  type DocumentNode,
  type GraphQLSchema,
  Kind,
  parse,
  print,
  printSchema,
} from "graphql";

export interface PruneDocumentNodeInput {
  readonly documentNode: DocumentNode;
  readonly customScalarNames: ReadonlyArray<string> | null;
}

export interface PruneDocumentNodeResult {
  readonly documentNode: DocumentNode;
  readonly removedTypes: ReadonlyArray<string>;
}

function getTypeNamesFromDocument(documentNode: DocumentNode): Set<string> {
  const typeNames = new Set<string>();

  for (const definition of documentNode.definitions) {
    if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.ENUM_TYPE_DEFINITION ||
      definition.kind === Kind.UNION_TYPE_DEFINITION ||
      definition.kind === Kind.SCALAR_TYPE_DEFINITION ||
      definition.kind === Kind.INTERFACE_TYPE_DEFINITION
    ) {
      typeNames.add(definition.name.value);
    }
  }

  return typeNames;
}

function getTypeNamesFromSchema(schema: GraphQLSchema): Set<string> {
  const typeNames = new Set<string>();
  const typeMap = schema.getTypeMap();

  for (const typeName of Object.keys(typeMap)) {
    if (!typeName.startsWith("__")) {
      typeNames.add(typeName);
    }
  }

  return typeNames;
}

function extractCustomScalarDefinitions(
  documentNode: DocumentNode,
  customScalarNames: ReadonlyArray<string>,
): DocumentNode["definitions"] {
  const customScalarSet = new Set(customScalarNames);
  return documentNode.definitions.filter(
    (def) =>
      def.kind === Kind.SCALAR_TYPE_DEFINITION &&
      customScalarSet.has(def.name.value),
  );
}

/**
 * DocumentNode から未使用の型を削除する。
 * Query、Mutation、Subscription から参照されていない型を削除対象とする。
 * カスタムスカラーは pruning 対象外として保持する。
 */
export function pruneDocumentNode(
  input: PruneDocumentNodeInput,
): PruneDocumentNodeResult {
  const { documentNode } = input;
  const customScalarNames = input.customScalarNames ?? [];

  const originalTypeNames = getTypeNamesFromDocument(documentNode);
  const customScalarSet = new Set(customScalarNames);

  const customScalarDefinitions = extractCustomScalarDefinitions(
    documentNode,
    customScalarNames,
  );

  const sdl = print(documentNode);
  const schema = buildASTSchema(parse(sdl));

  const prunedSchema = pruneSchema(schema, {
    skipPruning: (type) => customScalarSet.has(type.name),
  });

  const prunedSdl = printSchema(prunedSchema);
  const prunedDocument = parse(prunedSdl);
  const prunedTypeNames = getTypeNamesFromSchema(prunedSchema);

  const finalDocument: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [...customScalarDefinitions, ...prunedDocument.definitions],
  };

  const removedTypes: string[] = [];
  for (const typeName of originalTypeNames) {
    if (!prunedTypeNames.has(typeName) && !customScalarSet.has(typeName)) {
      removedTypes.push(typeName);
    }
  }

  return {
    documentNode: finalDocument,
    removedTypes: removedTypes.sort(),
  };
}
