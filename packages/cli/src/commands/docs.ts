import { access, readFile, symlink } from "node:fs/promises";
import { dirname, join, parse, relative, resolve } from "node:path";
import { define } from "gunshi";
import type { OutputWriter } from "../gen-orchestrator/reporter/progress-reporter.js";
import { writeFiles } from "../gen-orchestrator/writer/file-writer.js";

const SKILL_NAME = "gqlkit-guide";

export interface RunDocsCommandOptions {
  readonly output: string;
  readonly claude: boolean;
  readonly codex: boolean;
}

export interface RunDocsCommandResult {
  readonly exitCode: number;
  readonly filesWritten: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findNodeModulesDocsPath(
  startDir: string,
): Promise<string | null> {
  let currentDir = resolve(startDir);
  const root = parse(currentDir).root;

  while (currentDir !== root) {
    const candidate = join(currentDir, "node_modules/@gqlkit-ts/cli/docs");
    if (await exists(candidate)) {
      return candidate;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  return null;
}

async function detectClaudeEnvironment(dir: string): Promise<boolean> {
  const claudeMdExists = await exists(join(dir, "CLAUDE.md"));
  const claudeDirExists = await exists(join(dir, ".claude"));
  return claudeMdExists || claudeDirExists;
}

async function detectCodexEnvironment(dir: string): Promise<boolean> {
  const agentsMdExists = await exists(join(dir, "AGENTS.md"));
  const codexDirExists = await exists(join(dir, ".codex"));
  return agentsMdExists || codexDirExists;
}

function generateSkillMd(): string {
  return `---
name: ${SKILL_NAME}
description: Use when the user asks about "gqlkit", "gqlkit usage", "gqlkit schema definition", "gqlkit configuration", "gqlkit resolvers", "GraphQL code generation with gqlkit", or needs guidance on gqlkit conventions, type definitions, or integration with GraphQL servers or ORMs.
---

# gqlkit Guide

gqlkit generates GraphQL schema and resolver maps from TypeScript types and functions.

## How it works

1. Write TypeScript types in \`src/gqlkit/schema/\` → become GraphQL types
2. Write resolver functions using \`defineQuery\`, \`defineMutation\`, \`defineField\` → become GraphQL resolvers
3. Run \`gqlkit gen\` → outputs \`typeDefs\` and \`resolvers\` to \`src/gqlkit/__generated__/\`

## Design principles

- **Implement first**: Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.
- **Just types and functions**: Plain TypeScript with a thin API. No decorators, no complex generics.
- **Type-safe**: TypeScript types become GraphQL types. Resolver signatures checked at compile time.

## How to Use This Skill

Read [references/index.md](references/index.md) first. It contains the complete documentation index with all available topics.

Navigate to specific documentation files based on user needs as indicated in the index.
`;
}

function generateRules(): string {
  return `## gqlkit

When working with GraphQL schema, types, or resolvers using gqlkit, use the \`${SKILL_NAME}\` skill.
`;
}

async function createSymlinkIfNotExists(
  linkPath: string,
  target: string,
): Promise<void> {
  try {
    await symlink(target, linkPath, "dir");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/** Writes a single file through the shared file-writer, throwing on failure. */
async function writeFileOrThrow(
  filePath: string,
  content: string,
): Promise<void> {
  const result = await writeFiles({ files: [{ filePath, content }] });
  if (result.error) {
    throw result.error;
  }
}

async function appendOrCreateFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    const existing = await readFile(filePath, "utf-8");
    if (!existing.includes("## gqlkit")) {
      await writeFileOrThrow(filePath, `${existing}\n${content}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeFileOrThrow(filePath, content);
    } else {
      throw error;
    }
  }
}

interface AiToolConfig {
  readonly configDir: string;
  readonly rulesFile: string;
}

async function generateToolFiles(
  outputDir: string,
  config: AiToolConfig,
  filesWritten: string[],
): Promise<void> {
  const skillDir = join(outputDir, `${config.configDir}/skills/${SKILL_NAME}`);

  const skillMdPath = join(skillDir, "SKILL.md");
  await writeFileOrThrow(skillMdPath, generateSkillMd());
  filesWritten.push(skillMdPath);

  const docsPath = await findNodeModulesDocsPath(skillDir);
  if (docsPath === null) {
    throw new Error(
      `Could not find @gqlkit-ts/cli docs directory under node_modules (starting from ${resolve(skillDir)}). ` +
        "Ensure @gqlkit-ts/cli is installed.",
    );
  }

  const referencesPath = join(skillDir, "references");
  const relativePath = relative(skillDir, docsPath);
  await createSymlinkIfNotExists(referencesPath, relativePath);
  filesWritten.push(referencesPath);

  const rulesPath = join(outputDir, config.rulesFile);
  await appendOrCreateFile(rulesPath, generateRules());
  filesWritten.push(rulesPath);
}

export async function runDocsCommand(
  options: RunDocsCommandOptions,
): Promise<RunDocsCommandResult> {
  const writer: OutputWriter = {
    stdout: (msg: string) => console.log(msg),
    stderr: (msg: string) => console.error(msg),
  };

  const filesWritten: string[] = [];

  const autoDetect = !options.claude && !options.codex;
  const generateClaude =
    options.claude ||
    (autoDetect && (await detectClaudeEnvironment(options.output)));
  const generateCodex =
    options.codex ||
    (autoDetect && (await detectCodexEnvironment(options.output)));

  if (!generateClaude && !generateCodex) {
    writer.stdout(
      "No AI tool environment detected. Use --claude or --codex to generate explicitly.",
    );
    return { exitCode: 0, filesWritten: [] };
  }

  try {
    if (generateClaude) {
      await generateToolFiles(
        options.output,
        { configDir: ".claude", rulesFile: "CLAUDE.md" },
        filesWritten,
      );
    }

    if (generateCodex) {
      await generateToolFiles(
        options.output,
        { configDir: ".codex", rulesFile: "AGENTS.md" },
        filesWritten,
      );
    }
  } catch (error) {
    writer.stderr(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    return { exitCode: 1, filesWritten: [] };
  }

  for (const filePath of filesWritten) {
    writer.stdout(`Generated: ${filePath}`);
  }

  return { exitCode: 0, filesWritten };
}

export const docsCommand = define({
  name: "docs",
  args: {
    output: {
      type: "string",
      description: "Output directory for generated files",
    },
    claude: {
      type: "boolean",
      description: `Generate Claude Code files (.claude/skills/${SKILL_NAME}/, CLAUDE.md)`,
    },
    codex: {
      type: "boolean",
      description: `Generate Codex files (.codex/skills/${SKILL_NAME}/, AGENTS.md)`,
    },
  },
  run: async (ctx) => {
    const output = ctx.values.output ?? process.cwd();
    const claude = ctx.values.claude ?? false;
    const codex = ctx.values.codex ?? false;
    const result = await runDocsCommand({ output, claude, codex });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
  },
});
