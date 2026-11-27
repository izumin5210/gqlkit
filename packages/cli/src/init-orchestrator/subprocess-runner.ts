import { spawn } from "node:child_process";

export interface RunCommandOptions {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
}

export interface RunCommandResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export function runCommand(
  options: RunCommandOptions,
): Promise<RunCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      const exitCode = code ?? 0;
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
      });
    });

    child.on("error", (error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const enhancedStderr =
        stderr.length > 0
          ? `${stderr}\nProcess failed to spawn: ${errorMessage}`
          : `Process failed to spawn: ${errorMessage}`;
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: enhancedStderr,
      });
    });
  });
}
