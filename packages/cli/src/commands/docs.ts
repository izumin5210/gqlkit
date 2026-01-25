import { access, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { define } from "gunshi";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_DOCS_DIR = join(__dirname, "../../docs");
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

async function appendOrCreateFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    const existing = await readFile(filePath, "utf-8");
    if (!existing.includes("## gqlkit")) {
      await writeFile(filePath, `${existing}\n${content}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeFile(filePath, content);
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
  await mkdir(skillDir, { recursive: true });

  const skillMdPath = join(skillDir, "SKILL.md");
  await writeFile(skillMdPath, generateSkillMd());
  filesWritten.push(skillMdPath);

  const referencesPath = join(skillDir, "references");
  const relativePath = relative(skillDir, CLI_DOCS_DIR);
  await createSymlinkIfNotExists(referencesPath, relativePath);
  filesWritten.push(referencesPath);

  const rulesPath = join(outputDir, config.rulesFile);
  await appendOrCreateFile(rulesPath, generateRules());
  filesWritten.push(rulesPath);
}

export async function runDocsCommand(
  options: RunDocsCommandOptions,
): Promise<RunDocsCommandResult> {
  if (!(await exists(CLI_DOCS_DIR))) {
    console.error(
      `Documentation directory not found: ${CLI_DOCS_DIR}\nRun "pnpm build" to generate documentation files.`,
    );
    return { exitCode: 1, filesWritten: [] };
  }

  const filesWritten: string[] = [];

  const autoDetect = !options.claude && !options.codex;
  const generateClaude =
    options.claude ||
    (autoDetect && (await detectClaudeEnvironment(options.output)));
  const generateCodex =
    options.codex ||
    (autoDetect && (await detectCodexEnvironment(options.output)));

  if (!generateClaude && !generateCodex) {
    console.log(
      "No AI tool environment detected. Use --claude or --codex to generate explicitly.",
    );
    return { exitCode: 0, filesWritten: [] };
  }

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
    for (const file of result.filesWritten) {
      console.log(`Generated: ${file}`);
    }
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
  },
});
