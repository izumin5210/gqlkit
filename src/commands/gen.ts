import { define } from "gunshi";

export const genCommand = define({
  name: "gen",
  run: (_ctx) => {
    console.log("Generating code...");
  },
});
