import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "claude-code",
  model: "claude-sonnet-4-6",
  runs: 1,
  earlyExit: false,
  copyFiles: "all",
  validation: "vitest",
  timeout: 3600,
};

export default config;
