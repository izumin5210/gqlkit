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
    await symlink(target, linkPath);
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

async function runDocsCommand(
  options: RunDocsCommandOptions,
): Promise<RunDocsCommandResult> {
  const filesWritten: string[] = [];

  const generateClaude =
    options.claude ||
    (!options.claude &&
      !options.codex &&
      (await detectClaudeEnvironment(options.output)));
  const generateCodex =
    options.codex ||
    (!options.claude &&
      !options.codex &&
      (await detectCodexEnvironment(options.output)));

  if (!generateClaude && !generateCodex) {
    console.log(
      "No AI tool environment detected. Use --claude or --codex to generate explicitly.",
    );
    return { exitCode: 0, filesWritten: [] };
  }

  if (generateClaude) {
    const claudeSkillDir = join(options.output, `.claude/skills/${SKILL_NAME}`);
    await mkdir(claudeSkillDir, { recursive: true });
    await writeFile(join(claudeSkillDir, "SKILL.md"), generateSkillMd());
    filesWritten.push(join(claudeSkillDir, "SKILL.md"));

    const claudeReferencesPath = join(claudeSkillDir, "references");
    const claudeRelativePath = relative(claudeSkillDir, CLI_DOCS_DIR);
    await createSymlinkIfNotExists(claudeReferencesPath, claudeRelativePath);
    filesWritten.push(claudeReferencesPath);

    const claudeMdPath = join(options.output, "CLAUDE.md");
    await appendOrCreateFile(claudeMdPath, generateRules());
    filesWritten.push(claudeMdPath);
  }

  if (generateCodex) {
    const codexSkillDir = join(options.output, `.codex/skills/${SKILL_NAME}`);
    await mkdir(codexSkillDir, { recursive: true });
    await writeFile(join(codexSkillDir, "SKILL.md"), generateSkillMd());
    filesWritten.push(join(codexSkillDir, "SKILL.md"));

    const codexReferencesPath = join(codexSkillDir, "references");
    const codexRelativePath = relative(codexSkillDir, CLI_DOCS_DIR);
    await createSymlinkIfNotExists(codexReferencesPath, codexRelativePath);
    filesWritten.push(codexReferencesPath);

    const agentsMdPath = join(options.output, "AGENTS.md");
    await appendOrCreateFile(agentsMdPath, generateRules());
    filesWritten.push(agentsMdPath);
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
