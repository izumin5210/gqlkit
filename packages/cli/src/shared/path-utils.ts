export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
