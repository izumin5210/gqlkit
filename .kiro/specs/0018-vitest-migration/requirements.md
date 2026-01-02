# Requirements Document

## Project Description (Input)
リポジトリ内のテストをすべて vitest に移行したい。ルートに vitest をインストールし、workspace 機能を利用してセットアップして。 globals は有効にしないでください。

## Introduction
このドキュメントは、gqlkit monorepo のテストフレームワークを Node.js built-in test runner から vitest に移行するための要件を定義する。vitest の workspace 機能を活用し、globals を無効にした明示的なインポートスタイルでのセットアップを行う。

## Requirements

### Requirement 1: vitest のルートレベルインストール
**Objective:** As a 開発者, I want リポジトリルートに vitest がインストールされている状態, so that すべてのパッケージで統一されたテスト環境を利用できる

#### Acceptance Criteria
1. The gqlkit repository shall have vitest installed as a devDependency at the root level
2. The gqlkit repository shall have vitest configuration file (vitest.config.ts または vitest.workspace.ts) at the root level
3. When `pnpm test` is executed at the root, the test runner shall execute vitest

### Requirement 2: vitest workspace 設定
**Objective:** As a 開発者, I want vitest workspace が適切に設定されている状態, so that 各パッケージのテストが独立して管理・実行できる

#### Acceptance Criteria
1. The vitest configuration shall include workspace definitions for all testable packages (cli, runtime)
2. The vitest workspace shall enable running tests for each package independently
3. The vitest workspace shall enable running all tests across the entire repository with a single command

### Requirement 3: globals 無効化
**Objective:** As a 開発者, I want vitest の globals が無効になっている状態, so that テストファイルで使用する関数が明示的にインポートされ、コードの可読性と型安全性が向上する

#### Acceptance Criteria
1. The vitest configuration shall NOT enable the globals option
2. When a test file is executed, the test runner shall require explicit imports of test functions (describe, it, expect, etc.) from vitest

### Requirement 4: 既存テストの移行
**Objective:** As a 開発者, I want 既存の Node.js built-in test runner で書かれたテストが vitest 形式に移行されている状態, so that すべてのテストが vitest で実行できる

#### Acceptance Criteria
1. When a test file uses Node.js built-in test runner API (node:test), the migration shall convert it to vitest API
2. When a test file uses Node.js built-in assert API, the migration shall convert it to vitest expect API
3. The migrated tests shall maintain the same test coverage as the original tests
4. The migrated tests shall pass after conversion

### Requirement 5: TypeScript サポート
**Objective:** As a 開発者, I want vitest が TypeScript ファイルを直接実行できる状態, so that 別途 tsx などのローダーを設定する必要がない

#### Acceptance Criteria
1. The vitest configuration shall support TypeScript test files (*.test.ts) without additional loaders
2. The vitest configuration shall respect the existing tsconfig.json settings

### Requirement 6: テストファイルパターンの維持
**Objective:** As a 開発者, I want 既存のテストファイル配置規約が維持される状態, so that コロケーションパターン（ソースファイルと同じ場所にテストファイルを配置）が継続して使用できる

#### Acceptance Criteria
1. The vitest configuration shall recognize colocated test files (*.test.ts alongside source files)
2. The vitest configuration shall recognize E2E test files in e2e/ subdirectories

