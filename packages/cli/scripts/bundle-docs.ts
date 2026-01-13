import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../src/docs-bundler/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPackageDir = path.resolve(__dirname, "..");
const docsContentDir = path.resolve(cliPackageDir, "../docs/src/content");
const targetDir = path.resolve(cliPackageDir, "docs");

async function main() {
  console.log("Bundling docs...");
  try {
    await run({
      sourceDir: docsContentDir,
      targetDir,
    });
    console.log("Docs bundled successfully to:", targetDir);
  } catch (err) {
    console.error("Failed to bundle docs:", (err as Error).message);
    process.exit(1);
  }
}

main();
