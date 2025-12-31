# Implementation Plan

## Task 1. 冗長なチェックの削除

- [x] 1. (P) isCreateGqlkitApisCall 関数から重複した文字列チェックを削除する
  - `RUNTIME_PACKAGE` 定数と同じ値をハードコードしている箇所（L127-132）を削除する
  - 既存のテストが全て通過することを確認する
  - _Requirements: 3.1, 3.2_
  - **実装メモ**: Task 3 で関数全体を削除したため、このタスクは自動的に完了

## Task 2. ブランド型による resolver 検出機能の実装

- [x] 2. detectResolverFromBrandedType 関数を実装する
  - TypeScript の型チェッカーを使用して、関数呼び出しの戻り値型を検査する
  - `ResolverBrandSymbol` プロパティ（unique symbol）の存在を確認する
  - ブランド型から `kind` プロパティを抽出して resolver の種別（query/mutation/field）を決定する
  - ブランド型が見つからない場合は `undefined` を返す
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - **実装ファイル**: `/packages/cli/src/resolver-extractor/extractor/define-api-extractor.ts`

## Task 3. extractDefineApiResolvers の更新

- [x] 3. extractDefineApiResolvers を detectResolverFromBrandedType を使用するように更新する
  - 既存の `isDestructuredDefineCall` と `findCreateGqlkitApisDestructuring` を削除
  - `detectResolverFromBrandedType` による検出に完全移行
  - ブランド型を持たない export は警告を出力してスキップ
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 4.1, 4.2_
  - **実装メモ**: 以下の関数を削除: `RUNTIME_PACKAGE`, `isCreateGqlkitApisCall`, `findCreateGqlkitApisDestructuring`, `isDestructuredDefineCall`, `DestructuredDefineInfo`

## Task 4. 単体テストの実装

- [x] 4.1 (P) ブランド型検出のテストを実装する
  - QueryResolver ブランド型が正しく検出されることを確認する
  - MutationResolver ブランド型が正しく検出されることを確認する
  - FieldResolver ブランド型が正しく検出されることを確認する
  - ブランド型を持たない関数に対して undefined が返されることを確認する
  - _Requirements: 1.1, 1.2, 1.3_
  - **テストファイル**: `/packages/cli/src/resolver-extractor/extractor/define-api-extractor.test.ts` - "branded type detection" セクション

- [x] 4.2 (P) Re-export パターンのテストを実装する
  - 単一の re-export（gqlkit.ts 経由）が正しく検出されることを確認する
  - 名前を変更して export されたケースが動作することを確認する
  - _Requirements: 1.4, 5.1_
  - **テストファイル**: `/packages/cli/src/resolver-extractor/extractor/define-api-extractor.test.ts` - "re-export pattern detection" セクション
  - **実装メモ**: テストヘルパー `createTestProgram` にカスタム `resolveModuleNames` を追加して仮想ファイル間のモジュール解決をサポート

## Task 5. 統合テストと examples 検証

- [x] 5. 既存の examples ディレクトリで動作確認する
  - 全ての examples で `pnpm gen` が正常に動作することを確認する
  - 生成された resolver map が期待通りの内容を含むことを検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 5.1_
  - **検証結果**: tsx 直接実行で basic-types example から Query フィールド (user, users) が正しく検出されることを確認
  - **追加対応**: `createProgramFromFiles` に `@gqlkit-ts/runtime` パスマッピングを追加 (`/packages/cli/src/type-extractor/extractor/type-extractor.ts`)
