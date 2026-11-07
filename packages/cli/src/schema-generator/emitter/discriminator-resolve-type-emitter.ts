import type {
  DiscriminatorResolveTypeInfo,
  DiscriminatorValueMapping,
} from "../../auto-type-generator/index.js";

/**
 * Groups value mappings by their value at a given field index.
 * Null values at the field index mean the member doesn't have that field,
 * so the member should be resolved directly at the current switch level.
 */
function groupMappingsByFieldValue(
  mappings: ReadonlyArray<DiscriminatorValueMapping>,
  fieldIndex: number,
): Map<string | null, DiscriminatorValueMapping[]> {
  const groups = new Map<string | null, DiscriminatorValueMapping[]>();
  for (const mapping of mappings) {
    const value = mapping.values[fieldIndex] ?? null;
    const group = groups.get(value) ?? [];
    group.push(mapping);
    groups.set(value, group);
  }
  return groups;
}

interface BuildSwitchBodyParams {
  readonly mappings: ReadonlyArray<DiscriminatorValueMapping>;
  readonly fieldNames: ReadonlyArray<string>;
  readonly fieldIndex: number;
  readonly indent: string;
}

/**
 * Builds a switch statement body for a given field level, recursing for nested fields.
 * Returns an array of code lines (without leading indentation for the switch itself).
 */
function buildSwitchBody(params: BuildSwitchBodyParams): string[] {
  const { mappings, fieldNames, fieldIndex, indent } = params;
  const fieldName = fieldNames[fieldIndex]!;
  const groups = groupMappingsByFieldValue(mappings, fieldIndex);
  const lines: string[] = [];

  lines.push(`${indent}switch (obj.${fieldName}) {`);

  for (const [value, groupMappings] of groups) {
    // Null value means the member doesn't have this field — resolved at the parent level
    if (value === null) {
      for (const mapping of groupMappings) {
        lines.push(
          `${indent}  case "${mapping.values[fieldIndex - 1]!}": return "${mapping.memberGraphQLTypeName}";`,
        );
      }
      continue;
    }

    const nextFieldIndex = fieldIndex + 1;
    const hasMoreFields = nextFieldIndex < fieldNames.length;

    // Check if all mappings in this group can be resolved directly
    // (either no more fields, or only one mapping, or all remaining values are null)
    const canResolveDirectly =
      groupMappings.length === 1 &&
      (!hasMoreFields || groupMappings[0]!.values[nextFieldIndex] === null);

    if (!hasMoreFields || canResolveDirectly) {
      // Single mapping or no more fields: emit direct return
      if (groupMappings.length === 1) {
        lines.push(
          `${indent}  case "${value}": return "${groupMappings[0]!.memberGraphQLTypeName}";`,
        );
      } else {
        // Multiple mappings at the leaf level — shouldn't happen with unique tuples
        for (const mapping of groupMappings) {
          lines.push(
            `${indent}  case "${value}": return "${mapping.memberGraphQLTypeName}";`,
          );
        }
      }
    } else {
      // Need nested switch for remaining fields
      lines.push(`${indent}  case "${value}":`);
      const nestedLines = buildSwitchBody({
        mappings: groupMappings,
        fieldNames,
        fieldIndex: nextFieldIndex,
        indent: `${indent}    `,
      });
      lines.push(...nestedLines);
    }
  }

  lines.push(`${indent}  default: return undefined;`);
  lines.push(`${indent}}`);

  return lines;
}

function buildObjTypeAnnotation(fieldNames: ReadonlyArray<string>): string {
  const fields = fieldNames.map((name) => `${name}: string`);
  return `{ ${fields.join("; ")} }`;
}

/**
 * Builds a resolver map entry for a discriminator-based __resolveType.
 *
 * For single discriminator field:
 *   TypeName: {
 *     __resolveType: (obj: { field: string }) => {
 *       switch (obj.field) {
 *         case "val": return "MemberType";
 *         default: return undefined;
 *       }
 *     },
 *   },
 *
 * For multiple discriminator fields, generates nested switch statements.
 */
export function buildDiscriminatorResolveTypeEntry(
  info: DiscriminatorResolveTypeInfo,
): string {
  const { unionTypeName, fieldNames, valueMappings } = info;
  const objType = buildObjTypeAnnotation(fieldNames);
  const baseIndent = "        ";

  const switchLines = buildSwitchBody({
    mappings: valueMappings,
    fieldNames,
    fieldIndex: 0,
    indent: baseIndent,
  });
  const switchBody = switchLines.join("\n");

  return `    ${unionTypeName}: {\n      __resolveType: (obj: ${objType}) => {\n${switchBody}\n      },\n    },`;
}
