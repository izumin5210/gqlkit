import {
  type DocumentNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  Kind,
  type TypeDefinitionNode,
  type TypeExtensionNode,
  type TypeNode,
} from "graphql";

export interface PruneDocumentNodeResult {
  readonly documentNode: DocumentNode;
  readonly removedTypes: ReadonlyArray<string>;
}

const ROOT_OPERATION_TYPE_NAMES = ["Query", "Mutation", "Subscription"];

function unwrapNamedTypeName(type: TypeNode): string {
  let current = type;
  while (current.kind !== Kind.NAMED_TYPE) {
    current = current.type;
  }
  return current.name.value;
}

/**
 * Collect the names of all types a definition or extension refers to:
 * field types and argument types (unwrapping list/non-null), input object
 * field types, union member types, and `implements` interface references.
 */
function collectReferencedTypeNames(
  node: TypeDefinitionNode | TypeExtensionNode,
): string[] {
  const names: string[] = [];

  switch (node.kind) {
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION:
      for (const iface of node.interfaces ?? []) {
        names.push(iface.name.value);
      }
      for (const field of node.fields ?? []) {
        names.push(unwrapNamedTypeName(field.type));
        for (const arg of field.arguments ?? []) {
          names.push(unwrapNamedTypeName(arg.type));
        }
      }
      break;
    case Kind.UNION_TYPE_DEFINITION:
    case Kind.UNION_TYPE_EXTENSION:
      for (const member of node.types ?? []) {
        names.push(member.name.value);
      }
      break;
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      for (const field of node.fields ?? []) {
        names.push(unwrapNamedTypeName(field.type));
      }
      break;
    default:
      // Scalar and enum definitions/extensions reference no other types.
      break;
  }

  return names;
}

interface DocumentIndex {
  readonly typeDefinitions: ReadonlyMap<string, TypeDefinitionNode>;
  readonly typeExtensions: ReadonlyMap<
    string,
    ReadonlyArray<TypeExtensionNode>
  >;
  /** Interface name -> names of object/interface types that implement it. */
  readonly implementersByInterface: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Argument types of directive definitions (always-kept roots). */
  readonly directiveArgumentTypeNames: ReadonlyArray<string>;
}

function indexDocument(documentNode: DocumentNode): DocumentIndex {
  const typeDefinitions = new Map<string, TypeDefinitionNode>();
  const typeExtensions = new Map<string, TypeExtensionNode[]>();
  const implementersByInterface = new Map<string, string[]>();
  const directiveArgumentTypeNames: string[] = [];

  for (const definition of documentNode.definitions) {
    if (definition.kind === Kind.DIRECTIVE_DEFINITION) {
      for (const arg of definition.arguments ?? []) {
        directiveArgumentTypeNames.push(unwrapNamedTypeName(arg.type));
      }
      continue;
    }

    if (isTypeDefinitionNode(definition)) {
      typeDefinitions.set(definition.name.value, definition);
    } else if (isTypeExtensionNode(definition)) {
      const existing = typeExtensions.get(definition.name.value) ?? [];
      existing.push(definition);
      typeExtensions.set(definition.name.value, existing);
    } else {
      continue;
    }

    if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.OBJECT_TYPE_EXTENSION ||
      definition.kind === Kind.INTERFACE_TYPE_DEFINITION ||
      definition.kind === Kind.INTERFACE_TYPE_EXTENSION
    ) {
      for (const iface of definition.interfaces ?? []) {
        const implementers =
          implementersByInterface.get(iface.name.value) ?? [];
        implementers.push(definition.name.value);
        implementersByInterface.set(iface.name.value, implementers);
      }
    }
  }

  return {
    typeDefinitions,
    typeExtensions,
    implementersByInterface,
    directiveArgumentTypeNames,
  };
}

function collectReachableTypeNames(index: DocumentIndex): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  function markReachable(name: string): void {
    if (!reachable.has(name)) {
      reachable.add(name);
      queue.push(name);
    }
  }

  for (const rootName of ROOT_OPERATION_TYPE_NAMES) {
    if (
      index.typeDefinitions.has(rootName) ||
      index.typeExtensions.has(rootName)
    ) {
      markReachable(rootName);
    }
  }

  // Directive definitions are always kept, so the types their arguments
  // refer to (e.g. an enum used only by a directive definition) must
  // survive as well.
  for (const name of index.directiveArgumentTypeNames) {
    markReachable(name);
  }

  while (queue.length > 0) {
    const name = queue.pop()!;

    const definition = index.typeDefinitions.get(name);
    if (definition !== undefined) {
      for (const referenced of collectReferencedTypeNames(definition)) {
        markReachable(referenced);
      }
    }

    // A kept type keeps its extensions, so their references are reachable too.
    for (const extension of index.typeExtensions.get(name) ?? []) {
      for (const referenced of collectReferencedTypeNames(extension)) {
        markReachable(referenced);
      }
    }

    // Keep every implementer of a reachable interface: at runtime,
    // `__resolveType` may return any implementer even when no field
    // references it directly.
    for (const implementer of index.implementersByInterface.get(name) ?? []) {
      markReachable(implementer);
    }
  }

  return reachable;
}

function hasRootOperationType(index: DocumentIndex): boolean {
  return ROOT_OPERATION_TYPE_NAMES.some(
    (name) =>
      index.typeDefinitions.get(name)?.kind === Kind.OBJECT_TYPE_DEFINITION,
  );
}

/**
 * Remove type definitions unreachable from the root operation types
 * (Query/Mutation/Subscription) from a schema DocumentNode.
 *
 * Semantics:
 * - The root operation type definitions and their `extend type` blocks seed
 *   the traversal; references are followed per
 *   {@link collectReferencedTypeNames}, plus all implementers of every
 *   reachable interface.
 * - Type extensions are kept iff their target definition is kept.
 * - Directive definitions are always kept (pruning unused directives is out
 *   of scope), and their argument types are treated as reachable.
 * - No-op when the document has no root operation type: a types-only project
 *   has an empty reachable set, and pruning would empty the schema.
 *
 * Unlike graphql-tools' `pruneSchema`, this filters the original
 * DocumentNode's definitions in place — no SDL round-trip, no schema
 * validation, and no restructuring of `extend type` blocks — so documents
 * whose types are all reachable pass through untouched.
 */
export function pruneDocumentNode(
  documentNode: DocumentNode,
): PruneDocumentNodeResult {
  const index = indexDocument(documentNode);

  if (!hasRootOperationType(index)) {
    return { documentNode, removedTypes: [] };
  }

  const reachable = collectReachableTypeNames(index);

  const removedTypes: string[] = [];
  const keptDefinitions = documentNode.definitions.filter((definition) => {
    if (isTypeDefinitionNode(definition)) {
      if (reachable.has(definition.name.value)) {
        return true;
      }
      removedTypes.push(definition.name.value);
      return false;
    }
    if (isTypeExtensionNode(definition)) {
      return reachable.has(definition.name.value);
    }
    // Directive definitions and any other definition kinds are always kept.
    return true;
  });

  if (removedTypes.length === 0) {
    return { documentNode, removedTypes: [] };
  }

  return {
    documentNode: { ...documentNode, definitions: keptDefinitions },
    removedTypes: removedTypes.sort(),
  };
}
