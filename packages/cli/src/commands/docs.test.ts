import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return memfs.fs.promises;
});

import { runDocsCommand } from "./docs.js";

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function normalizePaths(paths: string[]): string[] {
  return paths.map(normalizePath);
}

function setupVolume(files: Record<string, string>): void {
  vol.fromJSON({
    "/project/node_modules/@gqlkit-ts/cli/docs/index.md": "# Docs",
    ...files,
  });
}

describe("docs command", () => {
  beforeEach(() => {
    vol.reset();
  });

  describe("environment detection", () => {
    it("should detect Claude environment when CLAUDE.md exists", async () => {
      setupVolume({
        "/project/CLAUDE.md": "# Project",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/SKILL.md",
      );
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/CLAUDE.md",
      );
    });

    it("should detect Claude environment when .claude directory exists", async () => {
      setupVolume({
        "/project/.claude/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/SKILL.md",
      );
    });

    it("should detect Codex environment when AGENTS.md exists", async () => {
      setupVolume({
        "/project/AGENTS.md": "# Agents",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.codex/skills/gqlkit-guide/SKILL.md",
      );
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/AGENTS.md",
      );
    });

    it("should detect Codex environment when .codex directory exists", async () => {
      setupVolume({
        "/project/.codex/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.codex/skills/gqlkit-guide/SKILL.md",
      );
    });

    it("should detect both environments when both exist", async () => {
      setupVolume({
        "/project/CLAUDE.md": "# Project",
        "/project/AGENTS.md": "# Agents",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/SKILL.md",
      );
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.codex/skills/gqlkit-guide/SKILL.md",
      );
    });

    it("should return empty filesWritten when no environment detected", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(result.filesWritten).toEqual([]);
    });
  });

  describe("explicit flags", () => {
    it("should generate Claude files when --claude flag is set", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/SKILL.md",
      );
      expect(normalizePaths(result.filesWritten)).not.toContainEqual(
        expect.stringContaining(".codex"),
      );
    });

    it("should generate Codex files when --codex flag is set", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: false,
        codex: true,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.codex/skills/gqlkit-guide/SKILL.md",
      );
      expect(normalizePaths(result.filesWritten)).not.toContainEqual(
        expect.stringContaining(".claude"),
      );
    });

    it("should generate both when both flags are set", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: true,
        codex: true,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/SKILL.md",
      );
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.codex/skills/gqlkit-guide/SKILL.md",
      );
    });
  });

  describe("rules file appending", () => {
    it("should append rules to existing CLAUDE.md", async () => {
      setupVolume({
        "/project/CLAUDE.md": "# Project\n\nSome content\n",
      });

      await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      const content = vol.readFileSync("/project/CLAUDE.md", "utf-8");
      expect(content).toContain("# Project");
      expect(content).toContain("Some content");
      expect(content).toContain("## gqlkit");
      expect(content).toContain("gqlkit-guide");
    });

    it("should not duplicate rules if already present", async () => {
      setupVolume({
        "/project/CLAUDE.md":
          "# Project\n\n## gqlkit\n\nExisting gqlkit section\n",
      });

      await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      const content = vol.readFileSync("/project/CLAUDE.md", "utf-8") as string;
      const matches = content.match(/## gqlkit/g);
      expect(matches).toHaveLength(1);
    });

    it("should create CLAUDE.md if it does not exist when --claude is set", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      expect(vol.existsSync("/project/CLAUDE.md")).toBe(true);
      const content = vol.readFileSync("/project/CLAUDE.md", "utf-8");
      expect(content).toContain("## gqlkit");
    });
  });

  describe("SKILL.md generation", () => {
    it("should generate SKILL.md with correct content", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      const content = vol.readFileSync(
        "/project/.claude/skills/gqlkit-guide/SKILL.md",
        "utf-8",
      );
      expect(content).toContain("name: gqlkit-guide");
      expect(content).toContain("description:");
      expect(content).toContain("# gqlkit Guide");
      expect(content).toContain("## How it works");
      expect(content).toContain("references/index.md");
    });
  });

  describe("symlink creation", () => {
    it("should create references symlink", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/references",
      );
    });

    it("should not fail if symlink already exists", async () => {
      setupVolume({
        "/project/.claude/skills/gqlkit-guide/references": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  describe("node_modules docs discovery", () => {
    it("should find docs in project root node_modules", async () => {
      setupVolume({
        "/project/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/project/.claude/skills/gqlkit-guide/references",
      );
    });

    it("should find docs in monorepo root node_modules (hoisted)", async () => {
      vol.fromJSON({
        "/mono/node_modules/@gqlkit-ts/cli/docs/index.md": "# Docs",
        "/mono/packages/app/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/mono/packages/app",
        claude: true,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/mono/packages/app/.claude/skills/gqlkit-guide/references",
      );
    });

    it("should prefer nearest node_modules in monorepo", async () => {
      vol.fromJSON({
        "/mono/node_modules/@gqlkit-ts/cli/docs/index.md": "# Root Docs",
        "/mono/packages/app/node_modules/@gqlkit-ts/cli/docs/index.md":
          "# App Docs",
        "/mono/packages/app/.gitkeep": "",
      });

      const result = await runDocsCommand({
        output: "/mono/packages/app",
        claude: true,
        codex: false,
      });

      expect(result.exitCode).toBe(0);
      expect(normalizePaths(result.filesWritten)).toContain(
        "/mono/packages/app/.claude/skills/gqlkit-guide/references",
      );

      const symlinkTarget = vol.readlinkSync(
        "/mono/packages/app/.claude/skills/gqlkit-guide/references",
      );
      // Relative path to nearest node_modules: ../../../node_modules/...
      // If it used root node_modules, it would be ../../../../../../node_modules/...
      expect(normalizePath(symlinkTarget.toString())).toBe(
        "../../../node_modules/@gqlkit-ts/cli/docs",
      );
    });

    it("should return exit code 1 when node_modules docs not found", async () => {
      vol.fromJSON({
        "/project/CLAUDE.md": "# Project",
      });

      const result = await runDocsCommand({
        output: "/project",
        claude: true,
        codex: false,
      });

      expect(result.exitCode).toBe(1);
      expect(result.filesWritten).toEqual([]);
    });
  });
});
