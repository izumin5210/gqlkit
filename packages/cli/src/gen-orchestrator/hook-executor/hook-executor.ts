import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface HookExecutorOptions {
  /** Hook commands to execute */
  readonly commands: ReadonlyArray<string>;
  /** File paths to pass as arguments */
  readonly filePaths: ReadonlyArray<string>;
  /** Working directory for command execution */
  readonly cwd: string;
  /** Callback for each hook completion */
  readonly onHookComplete?: (result: SingleHookResult) => void;
}

export interface SingleHookResult {
  readonly command: string;
  readonly success: boolean;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface HookExecutorResult {
  /** True if all hooks succeeded */
  readonly success: boolean;
  /** Results for each hook in execution order */
  readonly results: ReadonlyArray<SingleHookResult>;
}

function quoteArg(arg: string): string {
  if (!/[^a-zA-Z0-9_\-./]/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function buildCommand(
  command: string,
  filePaths: ReadonlyArray<string>,
): string {
  const quotedPaths = filePaths.map(quoteArg).join(" ");
  return `${command} ${quotedPaths}`;
}

function getEnvWithNodeModulesBin(cwd: string): NodeJS.ProcessEnv {
  const nodeModulesBin = resolve(cwd, "node_modules", ".bin");
  const currentPath = process.env["PATH"] ?? "";
  return {
    ...process.env,
    PATH: `${nodeModulesBin}:${currentPath}`,
  };
}

async function executeSingleHook(
  command: string,
  filePaths: ReadonlyArray<string>,
  cwd: string,
): Promise<SingleHookResult> {
  const fullCommand = buildCommand(command, filePaths);
  const env = getEnvWithNodeModulesBin(cwd);

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd,
      env,
      shell: "/bin/sh",
    });

    return {
      command,
      success: true,
      exitCode: 0,
      stdout,
      stderr,
    };
  } catch (error) {
    const execError = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };

    return {
      command,
      success: false,
      exitCode: execError.code ?? null,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
    };
  }
}

export async function executeHooks(
  options: HookExecutorOptions,
): Promise<HookExecutorResult> {
  const { commands, filePaths, cwd, onHookComplete } = options;
  const results: SingleHookResult[] = [];
  let allSuccess = true;

  for (const command of commands) {
    const result = await executeSingleHook(command, filePaths, cwd);
    results.push(result);

    if (!result.success) {
      allSuccess = false;
    }

    if (onHookComplete) {
      onHookComplete(result);
    }
  }

  return {
    success: allSuccess,
    results,
  };
}
