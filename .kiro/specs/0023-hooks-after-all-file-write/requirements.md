# Requirements Document

## Introduction

このドキュメントは、gqlkit CLI に graphql-codegen と同様の `hooks.afterAllFileWrite` オプションを追加するための要件を定義する。このフックにより、すべてのファイル生成完了後に Prettier や ESLint などの外部ツールを自動実行できるようになる。

## Requirements

### Requirement 1: Hook Configuration

**Objective:** As a developer, I want to configure afterAllFileWrite hooks in gqlkit.config.ts, so that I can automatically run post-processing commands after code generation.

#### Acceptance Criteria

1. When `hooks.afterAllFileWrite` is configured in gqlkit.config.ts, the gqlkit CLI shall recognize the hook configuration.
2. When a single command string is specified for `hooks.afterAllFileWrite`, the gqlkit CLI shall accept it as a valid configuration.
3. When an array of command strings is specified for `hooks.afterAllFileWrite`, the gqlkit CLI shall accept it as a valid configuration.
4. If `hooks` or `hooks.afterAllFileWrite` is not specified, the gqlkit CLI shall proceed without executing any post-write hooks.
5. The gqlkit CLI shall support the following configuration format:
   ```typescript
   defineConfig({
     hooks: {
       afterAllFileWrite: ["prettier --write", "eslint --fix"]
     }
   })
   ```

### Requirement 2: Hook Execution

**Objective:** As a developer, I want the configured hooks to execute after all files are written, so that generated code is automatically formatted or linted.

#### Acceptance Criteria

1. When all files are successfully written and `hooks.afterAllFileWrite` is configured, the gqlkit CLI shall execute the configured commands.
2. When executing a hook command, the gqlkit CLI shall pass all written file paths as arguments to the command.
3. When multiple commands are configured, the gqlkit CLI shall execute them sequentially in the order specified.
4. While executing hook commands, the gqlkit CLI shall use the project root directory as the current working directory.
5. When a hook command contains special shell characters in file paths, the gqlkit CLI shall properly quote the file paths to prevent shell injection.

### Requirement 3: Error Handling

**Objective:** As a developer, I want clear feedback when hook execution fails, so that I can diagnose and fix issues.

#### Acceptance Criteria

1. If a hook command exits with a non-zero exit code, the gqlkit CLI shall report the failure with the command and exit code.
2. If a hook command fails, the gqlkit CLI shall continue to execute remaining hook commands.
3. If any hook command fails, the gqlkit CLI shall exit with a non-zero exit code after all hooks complete.
4. If a hook command cannot be found or executed, the gqlkit CLI shall report a descriptive error message including the command that failed.
5. When hook execution fails, the gqlkit CLI shall preserve all successfully written files (no rollback).

### Requirement 4: Execution Conditions

**Objective:** As a developer, I want hooks to run only when files are actually written, so that unnecessary command execution is avoided.

#### Acceptance Criteria

1. If code generation fails before file writing, the gqlkit CLI shall not execute any afterAllFileWrite hooks.
2. If no files are written (all outputs suppressed via null paths), the gqlkit CLI shall not execute any afterAllFileWrite hooks.
3. When running in dry-run mode (if supported), the gqlkit CLI shall not execute any afterAllFileWrite hooks.
4. When files are successfully written, the gqlkit CLI shall execute hooks regardless of whether file contents changed from previous run.

### Requirement 5: Progress Reporting

**Objective:** As a developer, I want visibility into hook execution status, so that I can understand what post-processing is happening.

#### Acceptance Criteria

1. When starting hook execution, the gqlkit CLI shall display a message indicating hooks are being executed.
2. When a hook command completes successfully, the gqlkit CLI shall display a success indicator for that command.
3. If a hook command fails, the gqlkit CLI shall display the error output from the command.
4. When all hooks complete, the gqlkit CLI shall display a summary of hook execution results.
