import type { Diagnostic } from "../type-extractor/types/index.js";
import type { GraphQLTypeInfo } from "../type-extractor/types/graphql.js";

export interface InterfaceValidationResult {
  readonly isValid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export function validateInterfaceImplementations(
  types: ReadonlyArray<GraphQLTypeInfo>,
): InterfaceValidationResult {
  const diagnostics: Diagnostic[] = [];
  const typeMap = new Map<string, GraphQLTypeInfo>();

  for (const type of types) {
    typeMap.set(type.name, type);
  }

  for (const type of types) {
    if (!type.implementedInterfaces || type.implementedInterfaces.length === 0) {
      continue;
    }

    for (const interfaceName of type.implementedInterfaces) {
      const interfaceType = typeMap.get(interfaceName);

      if (!interfaceType) {
        diagnostics.push({
          code: "INTERFACE_NOT_FOUND",
          message: `Type '${type.name}' implements unknown interface '${interfaceName}'`,
          severity: "error",
          location: {
            file: type.sourceFile,
            line: 1,
            column: 1,
          },
        });
        continue;
      }

      if (interfaceType.kind !== "Interface") {
        diagnostics.push({
          code: "INTERFACE_NOT_INTERFACE",
          message: `Type '${type.name}' attempts to implement '${interfaceName}' which is not an interface`,
          severity: "error",
          location: {
            file: type.sourceFile,
            line: 1,
            column: 1,
          },
        });
        continue;
      }

      if (!interfaceType.fields) {
        continue;
      }

      const typeFields = new Map(
        type.fields?.map((f) => [f.name, f]) ?? [],
      );

      for (const interfaceField of interfaceType.fields) {
        const typeField = typeFields.get(interfaceField.name);

        if (!typeField) {
          diagnostics.push({
            code: "INTERFACE_MISSING_FIELD",
            message: `Type '${type.name}' implements interface '${interfaceName}' but is missing field '${interfaceField.name}'`,
            severity: "error",
            location: {
              file: type.sourceFile,
              line: 1,
              column: 1,
            },
          });
          continue;
        }

        if (!isTypeCompatible(typeField.type, interfaceField.type)) {
          diagnostics.push({
            code: "INTERFACE_FIELD_TYPE_MISMATCH",
            message: `Type '${type.name}' field '${interfaceField.name}' has incompatible type with interface '${interfaceName}'`,
            severity: "error",
            location: {
              file: type.sourceFile,
              line: 1,
              column: 1,
            },
          });
        }
      }
    }
  }

  return {
    isValid: diagnostics.length === 0,
    diagnostics,
  };
}

interface FieldType {
  readonly typeName: string;
  readonly nullable: boolean;
  readonly list: boolean;
  readonly listItemNullable?: boolean | null;
}

function isTypeCompatible(
  implementingType: FieldType,
  interfaceType: FieldType,
): boolean {
  if (implementingType.typeName !== interfaceType.typeName) {
    return false;
  }

  if (implementingType.list !== interfaceType.list) {
    return false;
  }

  if (implementingType.nullable && !interfaceType.nullable) {
    return false;
  }

  if (implementingType.list) {
    if (
      implementingType.listItemNullable &&
      !interfaceType.listItemNullable
    ) {
      return false;
    }
  }

  return true;
}

export function detectCircularInterfaceReferences(
  types: ReadonlyArray<GraphQLTypeInfo>,
): InterfaceValidationResult {
  const diagnostics: Diagnostic[] = [];
  const typeMap = new Map<string, GraphQLTypeInfo>();

  for (const type of types) {
    if (type.kind === "Interface") {
      typeMap.set(type.name, type);
    }
  }

  for (const type of types) {
    if (type.kind !== "Interface" || !type.implementedInterfaces) {
      continue;
    }

    const visited = new Set<string>();
    const path: string[] = [];

    if (hasCircularReference(type.name, typeMap, visited, path)) {
      diagnostics.push({
        code: "INTERFACE_CIRCULAR_REFERENCE",
        message: `Circular interface inheritance detected: ${path.join(" -> ")}`,
        severity: "error",
        location: {
          file: type.sourceFile,
          line: 1,
          column: 1,
        },
      });
    }
  }

  return {
    isValid: diagnostics.length === 0,
    diagnostics,
  };
}

function hasCircularReference(
  typeName: string,
  typeMap: Map<string, GraphQLTypeInfo>,
  visited: Set<string>,
  path: string[],
): boolean {
  if (visited.has(typeName)) {
    path.push(typeName);
    return true;
  }

  visited.add(typeName);
  path.push(typeName);

  const type = typeMap.get(typeName);
  if (!type || !type.implementedInterfaces) {
    return false;
  }

  for (const interfaceName of type.implementedInterfaces) {
    if (hasCircularReference(interfaceName, typeMap, new Set(visited), [...path])) {
      return true;
    }
  }

  return false;
}
