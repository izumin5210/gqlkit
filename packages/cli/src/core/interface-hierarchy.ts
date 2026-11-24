export interface CollectTransitiveInterfacesParams {
  readonly typeName: string;
  readonly declaredInterfaces: ReadonlyArray<string>;
  /** Interface name → the interfaces it declares in its own `implements`. */
  readonly interfaceParents: ReadonlyMap<string, ReadonlyArray<string>>;
}

/**
 * GraphQL requires a type to list every interface it implements
 * transitively (an object implementing `Entity`, where `Entity implements
 * Node`, also implements `Node`). Declared interfaces come first, followed
 * by inherited ones in breadth-first discovery order.
 */
export function collectTransitiveInterfaces(
  params: CollectTransitiveInterfacesParams,
): ReadonlyArray<string> {
  const { typeName, declaredInterfaces, interfaceParents } = params;
  const collected = new Set<string>();
  const pending = [...declaredInterfaces];
  for (let i = 0; i < pending.length; i++) {
    const name = pending[i]!;
    // A circular hierarchy is reported as INTERFACE_CIRCULAR_REFERENCE;
    // skipping the type's own name keeps it from implementing itself here.
    if (name === typeName || collected.has(name)) {
      continue;
    }
    collected.add(name);
    pending.push(...(interfaceParents.get(name) ?? []));
  }
  return [...collected];
}
