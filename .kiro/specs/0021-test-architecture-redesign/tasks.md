# Implementation Plan

## Task 1: テストファイルの削除

- [x] 1.1 (P) orchestrator.ts 依存モジュールのテストファイル削除
  - gen-orchestrator 配下のテスト削除（orchestrator.test.ts, reporter/*.test.ts, writer/*.test.ts）
  - type-extractor 配下の全テストファイル削除（scanner, extractor, converter, validator, collector, types）
  - resolver-extractor 配下の全テストファイル削除（scanner, extractor）
  - schema-generator 配下の全テストファイル削除（builder, emitter, integrator, pruner, resolver-collector, validator）
  - shared 配下の全テストファイル削除（program-factory, branded-detector, tsdoc-parser, symbol-resolver, scalar-registry, tsconfig-loader）
  - golden.test.ts は削除対象から除外して保持する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.2 (P) E2E・Integration テストの削除
  - gen-orchestrator/e2e.test.ts および integration.test.ts の削除
  - type-extractor/integration.test.ts の削除
  - schema-generator/e2e/ ディレクトリ配下の全ファイル削除（description.e2e.test.ts, input-types.e2e.test.ts, output-options.e2e.test.ts）
  - _Requirements: 2.1, 2.2_

## Task 2: テストインフラの整合性確認

- [x] 2. テスト削除後のビルドと動作確認
  - pnpm check がエラーなく完了することを確認
  - pnpm test がエラーなく完了することを確認
  - golden.test.ts がすべてのテストケースをパスすることを確認（9件の既存ケース）
  - 保持対象テストが正常に動作することを確認（config, config-loader, commands 配下）
  - vitest.config.ts に不要な設定がないことを確認
  - _Requirements: 2.3, 2.4, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3_

## Task 3: カバレッジ計測環境の構築

- [x] 3. カバレッジプロバイダの導入と設定
  - @vitest/coverage-v8 を packages/cli の devDependencies に追加
  - vitest.config.ts にカバレッジ設定を追加（provider: v8, reporter: text/html/lcov）
  - カバレッジ対象として gen-orchestrator 配下を設定
  - テストファイル・testdata・index.ts をカバレッジ対象から除外
  - 行カバレッジ・関数カバレッジ・分岐カバレッジのレポート出力を有効化
  - pnpm test --coverage でレポートが生成されることを確認
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.4_

## Task 4: カバレッジ分析と不足テストの追加

- [x] 4.1 カバレッジレポートの生成と分析
  - pnpm test --coverage を実行してカバレッジレポートを生成
  - gen-orchestrator 配下のファイルのカバレッジ率を確認
  - orchestrator.ts の依存モジュールのカバレッジ率を確認
  - 未カバーの処理（エラーハンドリング、エッジケース、条件分岐）を特定
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.2 不足テストの追加
  - 未カバー処理が正常系の出力パターンなら testdata/ にケースを追加
  - エラーハンドリングやエッジケースのみユニットテストを追加
  - 追加テストは既存命名規則（*.test.ts）に従う
  - 内部ヘルパー関数の未カバーはカバレッジ除外を検討
  - 過剰なテスト追加を避け golden file テストでのカバーを優先
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.3_
