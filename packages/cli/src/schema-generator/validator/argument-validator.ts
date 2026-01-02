import type {
  Diagnostic,
  GraphQLFieldType,
} from "../../type-extractor/types/index.js";
import type {
  InputType,
  TypeExtension,
} from "../integrator/result-integrator.js";

export interface ValidationContext {
  readonly knownTypes: ReadonlySet<string>;
  readonly inputTypes: ReadonlySet<string>;
  readonly outputTypes: ReadonlySet<string>;
  readonly enumTypes: ReadonlySet<string>;
  readonly scalarTypes: ReadonlySet<string>;
}

export interface ArgumentValidationResult {
  readonly isValid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

function validateFieldArgumentType(
  argType: GraphQLFieldType,
  context: ValidationContext,
  resolverSourceFile: string,
): Diagnostic | null {
  const { typeName } = argType;

  if (context.scalarTypes.has(typeName)) {
    return null;
  }

  if (context.inputTypes.has(typeName)) {
    return null;
  }

  if (context.enumTypes.has(typeName)) {
    return null;
  }

  if (context.outputTypes.has(typeName)) {
    return {
      code: "OUTPUT_TYPE_IN_INPUT",
      message: `Argument type '${typeName}' is an output type. Arguments can only use scalars, enums, and input types.`,
      severity: "error",
      location: { file: resolverSourceFile, line: 1, column: 1 },
    };
  }

  return {
    code: "UNKNOWN_ARGUMENT_TYPE",
    message: `Argument type '${typeName}' is not defined. Define it in src/gql/types or use a scalar type.`,
    severity: "error",
    location: { file: resolverSourceFile, line: 1, column: 1 },
  };
}

function validateInputTypeFields(
  inputType: InputType,
  context: ValidationContext,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const field of inputType.fields) {
    const { typeName } = field.type;

    if (context.scalarTypes.has(typeName)) {
      continue;
    }

    if (context.inputTypes.has(typeName)) {
      continue;
    }

    if (context.enumTypes.has(typeName)) {
      continue;
    }

    if (context.outputTypes.has(typeName)) {
      diagnostics.push({
        code: "OUTPUT_TYPE_IN_INPUT",
        message: `Input type '${inputType.name}' references output type '${typeName}'. Input types can only reference scalars, enums, and other input types.`,
        severity: "error",
        location: { file: inputType.sourceFile, line: 1, column: 1 },
      });
      continue;
    }

    diagnostics.push({
      code: "UNKNOWN_ARGUMENT_TYPE",
      message: `Input type '${inputType.name}' references unknown type '${typeName}'.`,
      severity: "error",
      location: { file: inputType.sourceFile, line: 1, column: 1 },
    });
  }

  return diagnostics;
}

function detectCircularReferences(
  inputTypes: ReadonlyArray<InputType>,
  context: ValidationContext,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const inputTypeMap = new Map<string, InputType>();

  for (const inputType of inputTypes) {
    inputTypeMap.set(inputType.name, inputType);
  }

  function findCycle(
    typeName: string,
    visited: Set<string>,
    path: string[],
    allNullable: boolean,
  ): { hasCycle: boolean; cyclePath: string[]; allNullableInCycle: boolean } {
    if (visited.has(typeName)) {
      const cycleStart = path.indexOf(typeName);
      if (cycleStart !== -1) {
        return {
          hasCycle: true,
          cyclePath: path.slice(cycleStart),
          allNullableInCycle: allNullable,
        };
      }
      return { hasCycle: false, cyclePath: [], allNullableInCycle: true };
    }

    const inputType = inputTypeMap.get(typeName);
    if (!inputType) {
      return { hasCycle: false, cyclePath: [], allNullableInCycle: true };
    }

    visited.add(typeName);
    path.push(typeName);

    for (const field of inputType.fields) {
      const referencedType = field.type.typeName;

      if (!context.inputTypes.has(referencedType)) {
        continue;
      }

      const fieldNullable = field.type.nullable;
      const result = findCycle(
        referencedType,
        visited,
        path,
        allNullable && fieldNullable,
      );

      if (result.hasCycle && !result.allNullableInCycle) {
        return result;
      }
    }

    path.pop();
    return { hasCycle: false, cyclePath: [], allNullableInCycle: true };
  }

  const checked = new Set<string>();

  for (const inputType of inputTypes) {
    if (checked.has(inputType.name)) {
      continue;
    }

    const result = findCycle(inputType.name, new Set(), [], true);

    if (result.hasCycle && !result.allNullableInCycle) {
      const cyclePath = [...result.cyclePath, result.cyclePath[0]];
      diagnostics.push({
        code: "CIRCULAR_INPUT_REFERENCE",
        message: `Circular reference detected: ${cyclePath?.join(" -> ")}`,
        severity: "error",
        location: { file: inputType.sourceFile, line: 1, column: 1 },
      });
    }

    for (const typeName of result.cyclePath) {
      checked.add(typeName);
    }
  }

  return diagnostics;
}

export function validateArguments(
  typeExtensions: ReadonlyArray<TypeExtension>,
  inputTypes: ReadonlyArray<InputType>,
  context: ValidationContext,
): ArgumentValidationResult {
  const diagnostics: Diagnostic[] = [];

  for (const ext of typeExtensions) {
    for (const field of ext.fields) {
      if (!field.args) {
        continue;
      }

      for (const arg of field.args) {
        const diagnostic = validateFieldArgumentType(
          arg.type,
          context,
          field.resolverSourceFile,
        );
        if (diagnostic) {
          diagnostics.push(diagnostic);
        }
      }
    }
  }

  for (const inputType of inputTypes) {
    const inputDiagnostics = validateInputTypeFields(inputType, context);
    diagnostics.push(...inputDiagnostics);
  }

  const circularDiagnostics = detectCircularReferences(inputTypes, context);
  diagnostics.push(...circularDiagnostics);

  return {
    isValid: diagnostics.length === 0,
    diagnostics,
  };
}
