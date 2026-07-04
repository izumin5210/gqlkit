import { pluralize } from "./pluralization.js";

/**
 * Converts an enum name from any naming convention to UPPER_SNAKE_CASE.
 *
 * Supports PascalCase, camelCase, UPPER_SNAKE_CASE, and single word inputs.
 *
 * @example
 * toUpperSnakeCase("UserStatus") // => "USER_STATUS"
 * toUpperSnakeCase("userStatus") // => "USER_STATUS"
 * toUpperSnakeCase("USER_STATUS") // => "USER_STATUS"
 * toUpperSnakeCase("Status") // => "STATUS"
 */
export function toUpperSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

/**
 * Builds the prefix candidate string for enum prefix stripping.
 *
 * Converts the enum name to UPPER_SNAKE_CASE and appends "_" to create
 * the prefix that will be checked against all enum values.
 *
 * @example
 * buildEnumPrefixCandidate("UserStatus") // => "USER_STATUS_"
 * buildEnumPrefixCandidate("userStatus") // => "USER_STATUS_"
 * buildEnumPrefixCandidate("USER_STATUS") // => "USER_STATUS_"
 * buildEnumPrefixCandidate("Status") // => "STATUS_"
 */
export function buildEnumPrefixCandidate(enumName: string): string {
  return `${toUpperSnakeCase(enumName)}_`;
}

function buildEnumPrefixCandidates(enumName: string): string[] {
  const upperSnakeName = toUpperSnakeCase(enumName);
  const baseCandidate = `${upperSnakeName}_`;
  const segments = upperSnakeName.split("_");
  const candidateSegmentSets: string[][] = [segments];

  if (segments.length === 0) {
    return [baseCandidate];
  }

  for (const [index, segment] of segments.entries()) {
    const pluralizedSegment = pluralize(segment);
    if (pluralizedSegment === segment) {
      continue;
    }

    const existingCandidates = [...candidateSegmentSets];
    for (const candidateSegments of existingCandidates) {
      const nextCandidateSegments = [...candidateSegments];
      nextCandidateSegments[index] = pluralizedSegment;
      candidateSegmentSets.push(nextCandidateSegments);
    }
  }

  return [
    ...new Set(
      candidateSegmentSets.map((candidate) => `${candidate.join("_")}_`),
    ),
  ];
}

export interface DetectEnumPrefixParams {
  readonly enumName: string;
  readonly memberValues: ReadonlyArray<string>;
}

export interface DetectEnumPrefixResult {
  readonly shouldStrip: boolean;
  readonly prefix: string | null;
}

/**
 * Detects whether an enum is a candidate for prefix stripping.
 *
 * Conditions for stripping:
 * 1. All memberValues must start with `${toUpperSnakeCase(enumName)}_`
 * 2. After removing the prefix, the remaining string must be non-empty
 *
 * @example
 * detectEnumPrefix({
 *   enumName: "UserStatus",
 *   memberValues: ["USER_STATUS_ACTIVE", "USER_STATUS_INACTIVE"]
 * })
 * // => { shouldStrip: true, prefix: "USER_STATUS_" }
 *
 * detectEnumPrefix({
 *   enumName: "UserStatus",
 *   memberValues: ["ACTIVE", "INACTIVE"]
 * })
 * // => { shouldStrip: false, prefix: null }
 */
export function detectEnumPrefix(
  params: DetectEnumPrefixParams,
): DetectEnumPrefixResult {
  const { enumName, memberValues } = params;

  if (memberValues.length === 0) {
    return { shouldStrip: false, prefix: null };
  }

  for (const prefixCandidate of buildEnumPrefixCandidates(enumName)) {
    let matches = true;

    for (const value of memberValues) {
      if (!value.startsWith(prefixCandidate)) {
        matches = false;
        break;
      }

      const stripped = value.slice(prefixCandidate.length);
      if (stripped === "") {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { shouldStrip: true, prefix: prefixCandidate };
    }
  }

  return { shouldStrip: false, prefix: null };
}

/**
 * Removes the detected prefix from an enum value.
 *
 * @example
 * stripEnumPrefix("USER_STATUS_ACTIVE", "USER_STATUS_")
 * // => "ACTIVE"
 */
export function stripEnumPrefix(value: string, prefix: string): string {
  return value.slice(prefix.length);
}
