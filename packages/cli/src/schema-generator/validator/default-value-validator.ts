import { Kind, type ConstValueNode } from "graphql";
import type {
  Diagnostic,
  GraphQLFieldType,
  SourceLocation,
} from "../../type-extractor/types/index.js";

export interface InputObjectFieldInfo {
  readonly name: string;
  readonly type: GraphQLFieldType;
}

export interface InputObjectInfo {
  readonly name: string;
  readonly fields: ReadonlyArray<InputObjectFieldInfo>;
}

export interface ValidationContext {
  readonly knownEnums: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly knownInputObjects: ReadonlyMap<string, InputObjectInfo>;
  readonly customScalars: ReadonlySet<string>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const BUILTIN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

function getValueKindDescription(value: ConstValueNode): string {
  switch (value.kind) {
    case Kind.STRING:
      return "string";
    case Kind.INT:
      return "integer";
    case Kind.FLOAT:
      return "float";
    case Kind.BOOLEAN:
      return "boolean";
    case Kind.NULL:
      return "null";
    case Kind.ENUM:
      return "enum";
    case Kind.LIST:
      return "list";
    case Kind.OBJECT:
      return "object";
    default:
      return "unknown";
  }
}

function validateScalarValue(
  typeName: string,
  value: ConstValueNode,
  fieldName: string,
  location: SourceLocation,
): ValidationResult {
  switch (typeName) {
    case "String":
      if (value.kind !== Kind.STRING) {
        return {
          valid: false,
          diagnostics: [
            {
              code: "DEFAULT_VALUE_TYPE_MISMATCH",
              message: `Field '${fieldName}' expects String type, but got ${getValueKindDescription(value)}.`,
              severity: "error",
              location,
            },
          ],
        };
      }
      break;
    case "Int":
      if (value.kind !== Kind.INT) {
        return {
          valid: false,
          diagnostics: [
            {
              code: "DEFAULT_VALUE_TYPE_MISMATCH",
              message: `Field '${fieldName}' expects Int type, but got ${getValueKindDescription(value)}.`,
              severity: "error",
              location,
            },
          ],
        };
      }
      break;
    case "Float":
      if (value.kind !== Kind.INT && value.kind !== Kind.FLOAT) {
        return {
          valid: false,
          diagnostics: [
            {
              code: "DEFAULT_VALUE_TYPE_MISMATCH",
              message: `Field '${fieldName}' expects Float type, but got ${getValueKindDescription(value)}.`,
              severity: "error",
              location,
            },
          ],
        };
      }
      break;
    case "Boolean":
      if (value.kind !== Kind.BOOLEAN) {
        return {
          valid: false,
          diagnostics: [
            {
              code: "DEFAULT_VALUE_TYPE_MISMATCH",
              message: `Field '${fieldName}' expects Boolean type, but got ${getValueKindDescription(value)}.`,
              severity: "error",
              location,
            },
          ],
        };
      }
      break;
    case "ID":
      if (value.kind !== Kind.STRING && value.kind !== Kind.INT) {
        return {
          valid: false,
          diagnostics: [
            {
              code: "DEFAULT_VALUE_TYPE_MISMATCH",
              message: `Field '${fieldName}' expects ID type (string or integer), but got ${getValueKindDescription(value)}.`,
              severity: "error",
              location,
            },
          ],
        };
      }
      break;
  }

  return { valid: true, diagnostics: [] };
}

function validateEnumValue(
  typeName: string,
  value: ConstValueNode,
  fieldName: string,
  location: SourceLocation,
  enumValues: ReadonlyArray<string>,
): ValidationResult {
  if (value.kind !== Kind.ENUM) {
    return {
      valid: false,
      diagnostics: [
        {
          code: "DEFAULT_VALUE_TYPE_MISMATCH",
          message: `Field '${fieldName}' expects enum ${typeName}, but got ${getValueKindDescription(value)}.`,
          severity: "error",
          location,
        },
      ],
    };
  }

  if (!enumValues.includes(value.value)) {
    return {
      valid: false,
      diagnostics: [
        {
          code: "UNKNOWN_ENUM_VALUE",
          message: `Field '${fieldName}': Enum value '${value.value}' does not exist on type ${typeName}. Valid values: ${enumValues.join(", ")}.`,
          severity: "error",
          location,
        },
      ],
    };
  }

  return { valid: true, diagnostics: [] };
}

function validateInputObjectValue(
  typeName: string,
  value: ConstValueNode,
  fieldName: string,
  location: SourceLocation,
  inputObjectInfo: InputObjectInfo,
  context: ValidationContext,
): ValidationResult {
  if (value.kind !== Kind.OBJECT) {
    return {
      valid: false,
      diagnostics: [
        {
          code: "DEFAULT_VALUE_TYPE_MISMATCH",
          message: `Field '${fieldName}' expects Input Object ${typeName}, but got ${getValueKindDescription(value)}.`,
          severity: "error",
          location,
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const knownFieldNames = new Set(inputObjectInfo.fields.map((f) => f.name));

  for (const objectField of value.fields) {
    const objectFieldName = objectField.name.value;

    if (!knownFieldNames.has(objectFieldName)) {
      diagnostics.push({
        code: "INVALID_INPUT_OBJECT_FIELD",
        message: `Field '${fieldName}': Unknown field '${objectFieldName}' on Input Object ${typeName}.`,
        severity: "error",
        location,
      });
      continue;
    }

    const fieldDef = inputObjectInfo.fields.find(
      (f) => f.name === objectFieldName,
    );
    if (fieldDef) {
      const fieldResult = validateValueForType(
        fieldDef.type,
        objectField.value as ConstValueNode,
        `${fieldName}.${objectFieldName}`,
        location,
        context,
      );
      diagnostics.push(...fieldResult.diagnostics);
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function validateListValue(
  fieldType: GraphQLFieldType,
  value: ConstValueNode,
  fieldName: string,
  location: SourceLocation,
  context: ValidationContext,
): ValidationResult {
  if (value.kind !== Kind.LIST) {
    return {
      valid: false,
      diagnostics: [
        {
          code: "DEFAULT_VALUE_TYPE_MISMATCH",
          message: `Field '${fieldName}' expects a list, but got ${getValueKindDescription(value)}.`,
          severity: "error",
          location,
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const elementType: GraphQLFieldType = {
    typeName: fieldType.typeName,
    nullable: fieldType.listItemNullable ?? true,
    list: false,
    listItemNullable: null,
  };

  for (let i = 0; i < value.values.length; i++) {
    const element = value.values[i];
    if (element) {
      const elementResult = validateValueForType(
        elementType,
        element as ConstValueNode,
        `${fieldName}[${i}]`,
        location,
        context,
      );
      diagnostics.push(...elementResult.diagnostics);
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function validateValueForType(
  fieldType: GraphQLFieldType,
  value: ConstValueNode,
  fieldName: string,
  location: SourceLocation,
  context: ValidationContext,
): ValidationResult {
  if (value.kind === Kind.NULL) {
    if (!fieldType.nullable) {
      return {
        valid: false,
        diagnostics: [
          {
            code: "NULL_DEFAULT_FOR_NON_NULL",
            message: `Field '${fieldName}' is non-nullable but has null default value.`,
            severity: "error",
            location,
          },
        ],
      };
    }
    return { valid: true, diagnostics: [] };
  }

  if (fieldType.list) {
    return validateListValue(fieldType, value, fieldName, location, context);
  }

  const { typeName } = fieldType;

  if (context.customScalars.has(typeName)) {
    return { valid: true, diagnostics: [] };
  }

  if (BUILTIN_SCALARS.has(typeName)) {
    return validateScalarValue(typeName, value, fieldName, location);
  }

  const enumValues = context.knownEnums.get(typeName);
  if (enumValues) {
    return validateEnumValue(typeName, value, fieldName, location, enumValues);
  }

  const inputObjectInfo = context.knownInputObjects.get(typeName);
  if (inputObjectInfo) {
    return validateInputObjectValue(
      typeName,
      value,
      fieldName,
      location,
      inputObjectInfo,
      context,
    );
  }

  return { valid: true, diagnostics: [] };
}

/**
 * Validate that a default value is compatible with the field type.
 */
export function validateDefaultValue(
  fieldType: GraphQLFieldType,
  defaultValue: ConstValueNode,
  fieldName: string,
  location: SourceLocation,
  context: ValidationContext,
): ValidationResult {
  return validateValueForType(
    fieldType,
    defaultValue,
    fieldName,
    location,
    context,
  );
}
