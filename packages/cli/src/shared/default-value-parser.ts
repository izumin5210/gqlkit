import { type ConstValueNode, Kind, parse } from "graphql";
import type {
  Diagnostic,
  SourceLocation,
} from "../type-extractor/types/index.js";

export interface DefaultValueParseResult {
  readonly value: ConstValueNode | null;
  readonly diagnostic: Diagnostic | null;
}

/**
 * Parse a TSDoc @defaultValue tag value into a GraphQL ConstValueNode.
 * Uses graphql-js public API to ensure GraphQL spec compliance.
 */
export function parseDefaultValue(
  tagValue: string,
  location: SourceLocation,
): DefaultValueParseResult {
  const trimmedValue = tagValue.trim();

  if (trimmedValue === "") {
    return {
      value: null,
      diagnostic: {
        code: "PARSE_ERROR",
        message:
          "@defaultValue tag is empty. Provide a valid GraphQL literal value.",
        severity: "error",
        location,
      },
    };
  }

  try {
    const documentNode = parse(`{_(x:${trimmedValue})}`, { noLocation: true });
    const operationDef = documentNode.definitions[0];

    if (
      operationDef?.kind !== Kind.OPERATION_DEFINITION ||
      operationDef.selectionSet.selections.length === 0
    ) {
      return {
        value: null,
        diagnostic: {
          code: "PARSE_ERROR",
          message: `Invalid @defaultValue: "${trimmedValue}" is not a valid GraphQL literal.`,
          severity: "error",
          location,
        },
      };
    }

    const selection = operationDef.selectionSet.selections[0];
    if (
      selection?.kind !== Kind.FIELD ||
      !selection.arguments ||
      selection.arguments.length === 0
    ) {
      return {
        value: null,
        diagnostic: {
          code: "PARSE_ERROR",
          message: `Invalid @defaultValue: "${trimmedValue}" is not a valid GraphQL literal.`,
          severity: "error",
          location,
        },
      };
    }

    const arg = selection.arguments[0];
    if (!arg) {
      return {
        value: null,
        diagnostic: {
          code: "PARSE_ERROR",
          message: `Invalid @defaultValue: "${trimmedValue}" is not a valid GraphQL literal.`,
          severity: "error",
          location,
        },
      };
    }

    const valueNode = arg.value;

    if (valueNode.kind === Kind.VARIABLE) {
      return {
        value: null,
        diagnostic: {
          code: "PARSE_ERROR",
          message: `Invalid @defaultValue: Variables ($${valueNode.name.value}) are not allowed in default values.`,
          severity: "error",
          location,
        },
      };
    }

    return {
      value: valueNode as ConstValueNode,
      diagnostic: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      value: null,
      diagnostic: {
        code: "PARSE_ERROR",
        message: `Invalid @defaultValue: ${errorMessage}`,
        severity: "error",
        location,
      },
    };
  }
}
