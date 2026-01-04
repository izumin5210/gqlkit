# Implementation Plan

## Task 1: Hook configuration type definitions

- [x] 1.1 (P) Define hook configuration types
  - Create types for hook settings that accept single command or command array
  - Define resolved configuration type with normalized array format
  - Extend existing configuration interfaces to include optional hooks section
  - Ensure readonly constraints for immutability
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.2 Implement hook configuration validation and normalization
  - Validate hooks object structure during config loading
  - Normalize single command string to single-element array
  - Reject empty command strings with descriptive error
  - Return default empty array when hooks not configured
  - Integrate validation into existing config loading pipeline
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Task 2: Hook executor implementation

- [x] 2.1 (P) Create hook execution core logic
  - Execute shell commands with file paths as arguments
  - Quote file paths safely to prevent shell injection
  - Add node_modules/.bin to PATH for local binaries
  - Use project root as working directory
  - _Requirements: 2.2, 2.4, 2.5_

- [x] 2.2 Implement sequential command execution with error collection
  - Run commands in configured order
  - Continue execution even when a command fails
  - Collect exit codes, stdout, and stderr for each command
  - Aggregate overall success/failure status
  - Report descriptive errors for missing commands
  - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

## Task 3: Progress reporting for hook execution

- [x] 3. (P) Add hook execution progress reporting
  - Display message when hook phase starts
  - Show success indicator for each completed command
  - Display error output when a command fails
  - Show summary of hook execution results
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

## Task 4: Gen command integration

- [x] 4.1 Wire hook execution into generation pipeline
  - Call hook executor after successful file writing
  - Pass written file paths to hook executor
  - Use reporter for progress feedback
  - _Requirements: 2.1_

- [x] 4.2 Implement execution condition checks
  - Skip hooks when generation fails before file writing
  - Skip hooks when no files are written
  - Skip hooks when configuration is empty
  - Handle future dry-run mode by skipping hooks
  - Preserve written files regardless of hook success
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.5_

- [x] 4.3 Handle hook failure exit codes
  - Exit CLI with non-zero code when any hook fails
  - Ensure all hooks complete before determining exit code
  - _Requirements: 3.3_

## Task 5: Testing

- [x] 5.1 Unit tests for hook configuration validation
  - Test undefined hooks returns default empty config
  - Test single command string normalizes to array
  - Test array of commands preserved correctly
  - Test empty command string produces error
  - Test invalid hook type produces error
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5.2 Unit tests for hook executor
  - Test successful command execution
  - Test failed command handling and continuation
  - Test file path quoting for special characters
  - Test command not found error messaging
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.4_

- [x] 5.3 Integration tests for gen command with hooks
  - Test generation with hooks configured
  - Test generation without hooks configured
  - Test hooks skipped when no files written
  - Test exit code when hooks fail
  - _Requirements: 2.1, 3.3, 4.1, 4.2, 4.4_
