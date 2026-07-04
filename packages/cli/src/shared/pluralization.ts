/**
 * Shared English pluralization heuristics.
 *
 * This module is the single home for the irregular singular/plural word
 * dictionary and the generic suffix rules used to convert between English
 * singular and plural forms. It replaces two previously independent
 * dictionaries with drifting word lists (see refactor-plan.md §1.2-D):
 * - auto-type-generator/naming-convention.ts used a plural -> singular
 *   dictionary (19 entries) to singularize array field names.
 * - shared/enum-prefix-detector.ts used a singular -> plural dictionary
 *   (15 entries) to build enum-value prefix candidates.
 *
 * The two lists turned out to agree on every word they had in common; the
 * naming-convention list had four extra entries (bus, selfie, status,
 * zombie) that enum-prefix-detector didn't need because its generic suffix
 * rule already produces the correct plural for them. Merging the lists is
 * therefore behavior-preserving for both consumers.
 */

/**
 * Irregular singular -> plural word pairs, lowercase canonical form.
 */
const IRREGULAR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["alias", "aliases"],
  ["analysis", "analyses"],
  ["bus", "buses"],
  ["child", "children"],
  ["cookie", "cookies"],
  ["crisis", "crises"],
  ["diagnosis", "diagnoses"],
  ["foot", "feet"],
  ["goose", "geese"],
  ["man", "men"],
  ["mouse", "mice"],
  ["movie", "movies"],
  ["person", "people"],
  ["selfie", "selfies"],
  ["status", "statuses"],
  ["thesis", "theses"],
  ["tooth", "teeth"],
  ["woman", "women"],
  ["zombie", "zombies"],
];

const IRREGULAR_PLURAL_TO_SINGULAR: ReadonlyMap<string, string> = new Map(
  IRREGULAR_PAIRS.map(([singular, plural]) => [plural, singular]),
);

const IRREGULAR_SINGULAR_TO_PLURAL_UPPER: ReadonlyMap<string, string> = new Map(
  IRREGULAR_PAIRS.map(([singular, plural]) => [
    singular.toUpperCase(),
    plural.toUpperCase(),
  ]),
);

const NON_INFLECTING_WORDS = new Set(["news", "series", "species"]);
const AMBIGUOUS_PLURAL_WORDS = new Set(["axes"]);

/**
 * Checks whether a single character is an English consonant, case-insensitive.
 */
function isConsonant(char: string): boolean {
  return /^[bcdfghjklmnpqrstvwxyz]$/i.test(char);
}

function isUppercaseLetter(char: string): boolean {
  return char.toLowerCase() !== char && char.toUpperCase() === char;
}

function applyReplacementCase(params: {
  readonly replacement: string;
  readonly template: string;
}): string {
  const { replacement, template } = params;

  if (template.toUpperCase() === template) {
    return replacement.toUpperCase();
  }

  if (isUppercaseLetter(template.charAt(0))) {
    return `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`;
  }

  return replacement;
}

function singularizeIrregularSuffix(name: string): string | null {
  const lowerName = name.toLowerCase();

  for (const [plural, singular] of IRREGULAR_PLURAL_TO_SINGULAR) {
    if (!lowerName.endsWith(plural)) {
      continue;
    }

    const suffixStart = name.length - plural.length;
    if (suffixStart > 0) {
      const previousChar = name.charAt(suffixStart - 1);
      const suffixFirstChar = name.charAt(suffixStart);
      const hasWordBoundary =
        previousChar === "_" ||
        previousChar === "-" ||
        isUppercaseLetter(suffixFirstChar);

      if (!hasWordBoundary) {
        continue;
      }
    }

    return `${name.slice(0, suffixStart)}${applyReplacementCase({
      replacement: singular,
      template: name.slice(suffixStart),
    })}`;
  }

  return null;
}

/**
 * Singularizes a name conservatively for array element type naming.
 *
 * Matches a known irregular plural as a suffix (respecting word boundaries,
 * so compound names like "userAliases" singularize correctly), then falls
 * back to generic English suffix rules. Falls back to the original name when
 * the plural form is ambiguous or non-inflecting.
 */
export function singularize(name: string): string {
  const irregularSingular = singularizeIrregularSuffix(name);
  if (irregularSingular) {
    return irregularSingular;
  }

  const lowerName = name.toLowerCase();

  if (name.length <= 3 || NON_INFLECTING_WORDS.has(lowerName)) {
    return name;
  }

  if (AMBIGUOUS_PLURAL_WORDS.has(lowerName)) {
    return name;
  }

  if (lowerName.endsWith("ies")) {
    if (name.length <= 4) {
      return name.slice(0, -1);
    }

    if (isConsonant(lowerName.at(-4) ?? "")) {
      return `${name.slice(0, -3)}y`;
    }
  }

  if (
    lowerName.endsWith("sses") ||
    lowerName.endsWith("shes") ||
    lowerName.endsWith("ches") ||
    lowerName.endsWith("xes") ||
    lowerName.endsWith("zes")
  ) {
    return name.slice(0, -2);
  }

  if (
    lowerName.endsWith("s") &&
    !lowerName.endsWith("ss") &&
    !lowerName.endsWith("is") &&
    !lowerName.endsWith("us")
  ) {
    return name.slice(0, -1);
  }

  return name;
}

/**
 * Pluralizes an UPPER_SNAKE_CASE segment using the irregular dictionary or
 * generic English suffix rules.
 */
export function pluralize(segment: string): string {
  const irregularPlural = IRREGULAR_SINGULAR_TO_PLURAL_UPPER.get(segment);
  if (irregularPlural) {
    return irregularPlural;
  }

  if (
    segment.endsWith("Y") &&
    segment.length > 1 &&
    isConsonant(segment.at(-2) ?? "")
  ) {
    return `${segment.slice(0, -1)}IES`;
  }

  if (
    segment.endsWith("S") ||
    segment.endsWith("SH") ||
    segment.endsWith("CH") ||
    segment.endsWith("X") ||
    segment.endsWith("Z")
  ) {
    return `${segment}ES`;
  }

  return `${segment}S`;
}
