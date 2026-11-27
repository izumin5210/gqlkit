export {
  type InitDiagnostic,
  type ResolveDirectoryOptions,
  type ResolveDirectoryResult,
  type ResolvedDirectories,
  resolveProjectDirectory,
} from "./directory-resolver.js";
export {
  type DetectExistingProjectOptions,
  type DetectExistingProjectResult,
  detectExistingProject,
} from "./existing-project-detector.js";
export {
  type GeneratedFile,
  type GenerateFilesOptions,
  type GenerateFilesResult,
  generateFiles,
} from "./file-generator.js";

export {
  type PackageJsonDiagnostic,
  type UpdatePackageJsonOptions,
  type UpdatePackageJsonResult,
  updatePackageJson,
} from "./package-json-updater.js";
export {
  type DetectPackageManagerOptions,
  type DetectPackageManagerResult,
  detectPackageManager,
  type PackageManager,
} from "./package-manager-detector.js";

export {
  type RunCommandOptions,
  type RunCommandResult,
  runCommand,
} from "./subprocess-runner.js";
