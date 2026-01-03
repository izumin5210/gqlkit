# Requirements Document

## Introduction

gqlkit のテストアーキテクチャを再設計する。コード生成ツールとして、入力（設定・元ファイル）に対する出力（生成ファイル）が意図通りになっているかを検証する golden file テストが最も重要である。現在の `packages/cli/src/gen-orchestrator/golden.test.ts` がこの役割を担っており、細かいユニットテストの多くは冗長である。本機能では、orchestrator.ts の依存関係にあるテストを削除し、カバレッジ計測に基づいて必要なテストのみを追加することで、テストスイートを最適化する。

## Requirements

### Requirement 1: ユニットテストの削除

**Objective:** As a 開発者, I want orchestrator.ts から直接・間接的に依存される関数のユニットテストを削除したい, so that golden file テストで十分にカバーされている冗長なテストを排除できる

#### Acceptance Criteria
1. When テスト削除を実行する場合, the テストスイート shall `packages/cli/src/gen-orchestrator/orchestrator.ts` から直接依存されるモジュールのテストファイルを削除する
2. When テスト削除を実行する場合, the テストスイート shall orchestrator.ts から間接的に依存されるモジュールのテストファイルも削除する
3. The テストスイート shall `packages/cli/src/gen-orchestrator/golden.test.ts` を削除せず保持する
4. When 依存関係を分析する場合, the 分析 shall orchestrator.ts の import 文を再帰的に追跡して依存モジュールを特定する

### Requirement 2: E2E・Integration テストの削除

**Objective:** As a 開発者, I want E2E テストと Integration テストを完全に削除したい, so that golden file テストで代替できる不要なテスト層を排除できる

#### Acceptance Criteria
1. The テストスイート shall `packages/cli/` 配下のすべての `e2e/` ディレクトリを削除する
2. The テストスイート shall integration test に関連するすべてのテストファイルを削除する
3. When E2E・Integration テストを削除した後, the プロジェクト shall ビルドエラーなくコンパイルできる状態を維持する
4. When E2E・Integration テストを削除した後, the プロジェクト shall 関連する設定ファイル（vitest.config.ts 等）から不要な設定を削除する

### Requirement 3: テストカバレッジの計測

**Objective:** As a 開発者, I want テスト削除後のカバレッジを計測したい, so that テストでカバーされていない処理を特定できる

#### Acceptance Criteria
1. When テスト削除が完了した後, the 開発者 shall Vitest のカバレッジ機能を使用してカバレッジを計測できる
2. The カバレッジレポート shall `packages/cli/src/gen-orchestrator/` 配下のファイルのカバレッジ率を表示する
3. The カバレッジレポート shall orchestrator.ts の依存モジュールのカバレッジ率を表示する
4. The カバレッジレポート shall 行カバレッジ・関数カバレッジ・分岐カバレッジを含む

### Requirement 4: 不足テストの追加

**Objective:** As a 開発者, I want カバレッジ計測結果に基づいて不足しているテストを追加したい, so that golden file テストでカバーできないエッジケースや例外処理をテストできる

#### Acceptance Criteria
1. When カバレッジ計測の結果テストされていない処理が特定された場合, the 開発者 shall 該当する処理に対するテストを追加する
2. The 追加されるテスト shall golden file テストではカバーできない処理（エラーハンドリング、エッジケース等）に限定する
3. The 追加されるテスト shall 既存のテストファイル命名規則（`*.test.ts`）に従う
4. If 追加するテストが golden file テストでカバー可能な場合, the 開発者 shall 新規ユニットテストではなく golden file テストケースを追加する

### Requirement 5: Golden File テストの保全

**Objective:** As a 開発者, I want golden file テストが主要なテスト戦略として機能し続けることを保証したい, so that コード生成の正確性を効率的に検証できる

#### Acceptance Criteria
1. The `golden.test.ts` shall リファクタリング後も正常に動作する
2. The `golden.test.ts` shall すべての既存テストケースをパスする
3. When 新しいテストケースが必要な場合, the 開発者 shall `packages/cli/src/gen-orchestrator/testdata/` に新しいテストデータを追加できる
4. The golden file テスト shall パラメータ化されたテストとして入力と期待出力のペアを検証する

### Requirement 6: テストインフラストラクチャの整合性

**Objective:** As a 開発者, I want テストインフラストラクチャが一貫した状態を維持することを保証したい, so that CI/CD パイプラインが正常に動作し続ける

#### Acceptance Criteria
1. When すべてのテスト変更が完了した後, the `pnpm test` shall エラーなく実行完了する
2. When すべてのテスト変更が完了した後, the `pnpm check` shall エラーなく実行完了する
3. The vitest.config.ts shall テスト削除後も適切な設定を維持する
4. If カバレッジ計測用の設定が必要な場合, the vitest.config.ts shall カバレッジプロバイダの設定を含む
