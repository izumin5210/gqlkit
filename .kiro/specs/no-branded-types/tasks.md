# Implementation Plan

## Task Format Template

Use whichever pattern fits the work breakdown:

### Major task only
- [ ] {{NUMBER}}. {{TASK_DESCRIPTION}}{{PARALLEL_MARK}}
  - {{DETAIL_ITEM_1}} *(Include details only when needed. If the task stands alone, omit bullet items.)*
  - _Requirements: {{REQUIREMENT_IDS}}_

### Major + Sub-task structure
- [ ] {{MAJOR_NUMBER}}. {{MAJOR_TASK_SUMMARY}}
- [ ] {{MAJOR_NUMBER}}.{{SUB_NUMBER}} {{SUB_TASK_DESCRIPTION}}{{SUB_PARALLEL_MARK}}
  - {{DETAIL_ITEM_1}}
  - {{DETAIL_ITEM_2}}
  - _Requirements: {{REQUIREMENT_IDS}}_ *(IDs only; do not add descriptions or parentheses.)*

> **Parallel marker**: Append ` (P)` only to tasks that can be executed in parallel. Omit the marker when running in `--sequential` mode.
>
> **Optional test coverage**: When a sub-task is deferrable test work tied to acceptance criteria, mark the checkbox as `- [ ]*` and explain the referenced requirements in the detail bullets.

---

## Tasks

- [x] 1. Runtime Scalar 型の簡素化
- [x] 1.1 (P) ScalarBrand 型と symbol の削除
  - Scalar 型に付与されていた branded 識別子を削除する
  - `ScalarBrandSymbol` の unique symbol 宣言を削除する
  - `ScalarBrand<K>` ジェネリック型を削除する
  - これらの export を削除し、参照箇所を解消する
  - _Requirements: 3.5_

- [x] 1.2 (P) Scalar 型を type alias として再定義
  - `IDString` を `type IDString = string` として定義する
  - `IDNumber` を `type IDNumber = number` として定義する
  - `Int` を `type Int = number` として定義する
  - `Float` を `type Float = number` として定義する
  - 各型が正しく export されていることを確認する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Runtime Resolver 型メタデータの変更
- [x] 2.1 ResolverBrandSymbol の削除と文字列プロパティへの置換
  - `ResolverBrandSymbol` の unique symbol 宣言を削除する
  - メタデータ保持用に `' $gqlkitResolver '` 文字列リテラルプロパティを定義する
  - プロパティ名にスペースを含めることで偶発的な名前衝突を防止する
  - _Requirements: 1.1_

- [x] 2.2 Resolver 型定義の更新
  - `QueryResolver` 型のメタデータプロパティを `{ [' $gqlkitResolver ']?: { kind: 'query'; args: TArgs; result: TResult } }` 形式に変更する
  - `MutationResolver` 型のメタデータプロパティを同様の形式に変更する
  - `FieldResolver` 型のメタデータプロパティを同様の形式に変更する（kind は 'field'）
  - プロパティを optional (?) として定義し、既存コードとの互換性を維持する
  - Task 2.1 の完了が前提
  - _Requirements: 1.1, 1.3_

- [x] 2.3 DefineApis 関数の戻り値型確認
  - `defineQuery`, `defineMutation`, `defineField` が新形式の Resolver 型を返すことを確認する
  - 関数シグネチャ自体は変更不要（戻り値型が自動的に新形式になる）
  - 型レベルでメタデータが正しく付与されることをテストで検証する
  - Task 2.2 の完了が前提
  - _Requirements: 1.3_

- [x] 3. CLI Resolver 検出ロジックの更新
- [x] 3.1 DefineApiExtractor のプロパティ検出ロジック変更
  - resolver 型からメタデータを取得する際のプロパティ検索条件を変更する
  - symbol 名 `ResolverBrandSymbol` を含むプロパティの検索から、文字列リテラル `' $gqlkitResolver '` を名前とするプロパティの検索に変更する
  - `kind` プロパティから resolver 種別（query/mutation/field）を取得するロジックは維持する
  - symbol ベースのメタデータ参照コードを完全に削除する
  - Task 2 の完了が前提
  - _Requirements: 1.2, 1.4, 2.4_

- [x] 4. 統合テスト・検証
- [x] 4.1 Golden file tests の実行と確認
  - 全ての golden file tests が変更なくパスすることを確認する
  - 生成される GraphQL スキーマに差分がないことを検証する
  - 既存の `branded-scalar` テストケースが引き続き正常動作することを確認する
  - Task 1, 2, 3 の完了が前提
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 4.2 Scalar 識別動作の確認
  - `@gqlkit-ts/runtime` から直接 import された scalar 型が正しく GraphQL scalar にマッピングされることを確認する
  - re-export 経由で使用された scalar 型が通常の型として扱われることを確認する
  - import 元パスと型名による識別が正常に機能することを検証する
  - Task 4.1 の完了が前提
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2_
