---
"@gqlkit-ts/cli": patch
"@gqlkit-ts/runtime": patch
---

build: include source files and maps in published packages

Sourcemaps (`.js.map`), declaration files (`.d.ts`), declaration maps (`.d.ts.map`), and original TypeScript source files are now included in npm packages. This improves debugging experience by allowing IDE go-to-definition to navigate directly to the original source code.
