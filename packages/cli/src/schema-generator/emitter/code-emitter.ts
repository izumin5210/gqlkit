import path from "node:path";
import { buildDocumentNode } from "../builder/ast-builder.js";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import type { ResolverInfo } from "../resolver-collector/resolver-collector.js";

export interface CodeEmitterResult {
  readonly typeDefs: string;
  readonly resolvers: string;
}

function formatDocumentNodeAsCode(integratedResult: IntegratedResult): string {
  const doc = buildDocumentNode(integratedResult);

  return JSON.stringify(doc, null, 2);
}

export function emitTypeDefsCode(integratedResult: IntegratedResult): string {
  const documentNodeCode = formatDocumentNodeAsCode(integratedResult);

  return `import type { DocumentNode } from "graphql";

export const typeDefs: DocumentNode = ${documentNodeCode} as DocumentNode;
`;
}

function computeRelativeImportPath(fromDir: string, toFile: string): string {
  const relativePath = path.relative(fromDir, toFile);
  const withoutExt = relativePath.replace(/\.ts$/, ".js");
  if (!withoutExt.startsWith(".")) {
    return `./${withoutExt}`;
  }
  return withoutExt;
}

export function emitResolversCode(
  resolverInfo: ResolverInfo,
  outputDir: string,
): string {
  const imports: string[] = [];
  const importedValues = new Set<string>();

  for (const sourceFile of resolverInfo.sourceFiles) {
    const resolverValueNames = new Set<string>();

    for (const type of resolverInfo.types) {
      for (const field of type.fields) {
        if (field.sourceFile === sourceFile) {
          resolverValueNames.add(field.resolverValueName);
        }
      }
    }

    const importPath = computeRelativeImportPath(outputDir, sourceFile);
    const uniqueValues = [...resolverValueNames].filter(
      (v) => !importedValues.has(v),
    );

    if (uniqueValues.length > 0) {
      imports.push(
        `import { ${uniqueValues.sort().join(", ")} } from "${importPath}";`,
      );
      for (const v of uniqueValues) {
        importedValues.add(v);
      }
    }
  }

  const typeEntries: string[] = [];
  for (const type of resolverInfo.types) {
    const fieldEntries = type.fields.map(
      (field) =>
        `      ${field.fieldName}: ${field.resolverValueName}.${field.fieldName},`,
    );
    typeEntries.push(
      `    ${type.typeName}: {\n${fieldEntries.join("\n")}\n    },`,
    );
  }

  return `${imports.join("\n")}

export const resolvers = {
${typeEntries.join("\n")}
} as const;
`;
}
