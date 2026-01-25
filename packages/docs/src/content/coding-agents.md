---
title: Coding Agents
description: Set up AI coding agents like Claude Code and Codex to understand gqlkit conventions. (skip if reading via `gqlkit-guide` skill)
---

# Coding Agents

gqlkit provides built-in support for AI coding agents like [Claude Code](https://claude.ai/code) and [OpenAI Codex](https://openai.com/index/openai-codex/). The `gqlkit docs` command generates skill files that help these tools understand gqlkit conventions and provide better assistance.

## Setup

Run the following command in your project root:

```sh filename="npm"
npm exec gqlkit docs
```

```sh filename="pnpm"
pnpm gqlkit docs
```

```sh filename="yarn"
yarn gqlkit docs
```

The command auto-detects your environment based on existing files (`CLAUDE.md`, `.claude/`, `AGENTS.md`, `.codex/`) and generates the appropriate files.

## Generated Files

### Claude Code

When Claude Code environment is detected (or `--claude` flag is used):

- `.claude/skills/gqlkit-guide/SKILL.md` - Skill definition with gqlkit documentation
- `.claude/skills/gqlkit-guide/references/` - Symlink to detailed documentation
- `CLAUDE.md` - Updated with gqlkit section (created if not exists)

### OpenAI Codex

When Codex environment is detected (or `--codex` flag is used):

- `.codex/skills/gqlkit-guide/SKILL.md` - Skill definition with gqlkit documentation
- `.codex/skills/gqlkit-guide/references/` - Symlink to detailed documentation
- `AGENTS.md` - Updated with gqlkit section (created if not exists)

## Options

| Option | Description |
|--------|-------------|
| `--output <dir>` | Output directory (default: current directory) |
| `--claude` | Generate Claude Code files explicitly |
| `--codex` | Generate Codex files explicitly |

## How It Works

The generated skill files follow the [Agent Skills](https://agentskills.io/) specification. When you ask the coding agent about gqlkit, it will:

1. Recognize gqlkit-related questions from the skill description
2. Read the bundled documentation to understand gqlkit conventions
3. Provide accurate guidance based on the latest documentation

## Keeping Skills Updated

Re-run `gqlkit docs` after updating gqlkit to ensure the skill files reflect the latest documentation.
