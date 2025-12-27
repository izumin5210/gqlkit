import { cli } from "gunshi";
import { genCommand } from "./commands/gen.js";
import { mainCommand } from "./commands/main.js";

await cli(process.argv.slice(2), mainCommand, {
  name: "gqlkit",
  version: "0.0.0",
  subCommands: {
    gen: genCommand,
  },
});
