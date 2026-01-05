export interface OutputWriter {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export interface ProgressReporter {
  startPhase(phaseName: string): void;
  fileWritten(filePath: string): void;
  complete(): void;

  /** Display hook execution start message */
  startHookPhase(): void;

  /** Display successful hook completion */
  hookCompleted(command: string): void;

  /** Display hook failure with error details */
  hookFailed(command: string, exitCode: number | null, stderr: string): void;

  /** Display hook phase summary */
  hookPhaseSummary(totalCount: number, failedCount: number): void;
}

export function createProgressReporter(writer: OutputWriter): ProgressReporter {
  return {
    startPhase(phaseName: string): void {
      writer.stdout(`  ${phaseName}...`);
    },
    fileWritten(filePath: string): void {
      writer.stdout(`    wrote ${filePath}`);
    },
    complete(): void {
      writer.stdout("  Done!");
    },
    startHookPhase(): void {
      writer.stdout("  Running hooks...");
    },
    hookCompleted(command: string): void {
      writer.stdout(`    hook completed: ${command}`);
    },
    hookFailed(command: string, exitCode: number | null, stderr: string): void {
      const exitCodeStr = exitCode !== null ? ` (exit code: ${exitCode})` : "";
      writer.stderr(`    hook failed: ${command}${exitCodeStr}`);
      const trimmedStderr = stderr.trim();
      if (trimmedStderr) {
        for (const line of trimmedStderr.split("\n")) {
          writer.stderr(`      ${line}`);
        }
      }
    },
    hookPhaseSummary(totalCount: number, failedCount: number): void {
      if (failedCount === 0) {
        writer.stdout(`  Hooks completed: ${totalCount} succeeded`);
      } else {
        writer.stderr(
          `  Hooks completed: ${totalCount - failedCount} succeeded, ${failedCount} failed`,
        );
      }
    },
  };
}
