export interface OutputWriter {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export interface ProgressReporter {
  startPhase(phaseName: string): void;
  fileWritten(filePath: string): void;
  complete(): void;
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
  };
}
