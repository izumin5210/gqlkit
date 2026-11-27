import { cli } from "gunshi";
import { docsCommand } from "./commands/docs.js";
import { genCommand } from "./commands/gen.js";
import { initCommand } from "./commands/init.js";
import { mainCommand } from "./commands/main.js";

await cli(process.argv.slice(2), mainCommand, {
  name: "gqlkit",
  version: "0.0.0",
  subCommands: {
    docs: docsCommand,
    gen: genCommand,
    init: initCommand,
  },
});
