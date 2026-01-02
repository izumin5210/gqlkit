# Implementation Plan

## Tasks

- [x] 1. vitest セットアップとワークスペース構成

- [x] 1.1 vitest をルートにインストール
  - ルート package.json の devDependencies に vitest を追加
  - _Requirements: 1.1_

- [x] 1.2 vitest.config.ts を作成しプロジェクト設定を定義
  - projects オプションで cli および runtime パッケージを定義
  - globals を明示的に false に設定（デフォルト動作だが要件明確化のため）
  - テストファイルパターン (src/**/*.test.ts) を指定
  - TypeScript ファイルの直接実行をサポート（追加ローダー不要）
  - _Requirements: 1.2, 2.1, 2.2, 3.1, 5.1, 5.2, 6.1, 6.2_

- [x] 1.3 テストスクリプトを更新
  - ルート package.json の test スクリプトを `vitest run` に変更
  - packages/cli および packages/runtime から test スクリプトを削除
  - _Requirements: 1.3, 2.3_

- [x] 2. (P) cli パッケージのテスト移行: shared モジュール

- [x] 2.1 shared/branded-detector.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 2.2 shared/scalar-registry.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 2.3 shared/symbol-resolver.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 2.4 shared/tsdoc-parser.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 3. (P) cli パッケージのテスト移行: config モジュール

- [x] 3.1 config/define-config.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 3.2 config/types.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 3.3 config-loader/loader.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 3.4 config-loader/validator.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4. (P) cli パッケージのテスト移行: type-extractor モジュール

- [x] 4.1 type-extractor/types/diagnostics.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.2 type-extractor/types/graphql.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.3 type-extractor/types/typescript.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.4 type-extractor/scanner/file-scanner.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.5 type-extractor/collector/result-collector.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.6 type-extractor/converter/graphql-converter.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.7 type-extractor/extractor/type-extractor.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.8 type-extractor/validator/type-validator.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.9 type-extractor/extract-types.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 4.10 type-extractor/integration.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 5. (P) cli パッケージのテスト移行: resolver-extractor モジュール

- [x] 5.1 resolver-extractor/scanner/file-scanner.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 5.2 resolver-extractor/extractor/define-api-extractor.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 5.3 resolver-extractor/extractor/parent-type-resolver.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 5.4 resolver-extractor/extract-resolvers.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6. (P) cli パッケージのテスト移行: schema-generator モジュール

- [x] 6.1 schema-generator/builder/ast-builder.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - assert.fail → expect.fail の変換を含む
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.2 schema-generator/emitter/code-emitter.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.3 schema-generator/emitter/sdl-emitter.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.4 schema-generator/integrator/result-integrator.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.5 schema-generator/pruner/schema-pruner.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.6 schema-generator/resolver-collector/resolver-collector.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.7 schema-generator/validator/argument-validator.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.8 schema-generator/generate-schema.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.9 schema-generator/e2e/description.e2e.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.10 schema-generator/e2e/input-types.e2e.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 6.11 schema-generator/e2e/output-options.e2e.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 7. (P) cli パッケージのテスト移行: gen-orchestrator モジュール

- [x] 7.1 gen-orchestrator/writer/file-writer.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 7.2 gen-orchestrator/reporter/diagnostic-reporter.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 7.3 gen-orchestrator/reporter/progress-reporter.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 7.4 gen-orchestrator/orchestrator.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 7.5 gen-orchestrator/integration.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 7.6 gen-orchestrator/e2e.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 8. (P) cli パッケージのテスト移行: commands モジュール

- [x] 8.1 commands/gen.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 9. (P) runtime パッケージのテスト移行

- [x] 9.1 runtime/src/index.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 9.2 runtime/src/scalars.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 9.3 runtime/src/types.test.ts を移行
  - node:test → vitest import、node:assert → expect API
  - _Requirements: 3.2, 4.1, 4.2_

- [x] 10. graphql モジュール重複問題を解決
  - schema-pruner.test.ts で発生している graphql モジュール重複エラーを修正
  - vitest 環境での graphql パッケージの解決方法を統一
  - _Requirements: 4.3_

- [x] 11. テスト全体のレビューおよび必要な修正の適用
  - `expect(a, b)` パターンを `expect(a).toBe(b)` に修正
  - その他の vitest API 移行漏れを確認・修正
  - _Requirements: 4.1, 4.2_

- [x] 12. 移行完了検証
  - pnpm test で全テストが pass することを確認
  - --project フラグによる個別パッケージ実行の動作確認
  - 移行前と同等のテストカバレッジが維持されていることを確認
  - _Requirements: 4.3, 4.4_

## Notes

- graphql モジュール重複問題は vitest.config.ts の resolve.alias と deps.inline 設定で解決済み
- schema-pruner.test.ts の `assert.deepEqual` と `expect(x.includes(y))` パターンは修正済み
- ast-builder.test.ts の `assert.fail` と `expect(a, b)` パターンは修正済み
- testTimeout を 30000ms に設定（TypeScript コンパイルを含むテストのため）
