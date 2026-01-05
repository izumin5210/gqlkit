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

- [x] 1. Runtime パッケージに Scalar Metadata 型を追加
- [x] 1.1 Built-in scalar 型を metadata 付き intersection type に変更
  - `Int` を `number & { " $gqlkitScalar"?: { name: "Int" } }` として定義
  - `Float` を `number & { " $gqlkitScalar"?: { name: "Float" } }` として定義
  - `IDString` を `string & { " $gqlkitScalar"?: { name: "ID" } }` として定義
  - `IDNumber` を `number & { " $gqlkitScalar"?: { name: "ID" } }` として定義
  - 既存の型エイリアスを intersection type に置き換え
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 1.2 DefineScalar utility type を実装
  - 3つの型パラメータ（Name, Base, Only）を持つ utility type を作成
  - Only パラメータはデフォルトで undefined（input/output 両用）
  - metadata プロパティを optional にして underlying type との互換性を維持
  - export して外部から利用可能にする
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 1.3 (P) Scalar metadata 構造の内部型定義
  - `ScalarMetadataShape` インターフェースを定義（name, only プロパティ）
  - 型レベルでの制約を正しく表現
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Type Extractor に MetadataDetector を実装
- [x] 2.1 TypeScript プリミティブ型の自動マッピング
  - `string` を GraphQL `String` にマッピング
  - `boolean` を GraphQL `Boolean` にマッピング
  - `number` を GraphQL `Float` にマッピング
  - 既存の型変換ロジックとの整合性を確認
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.2 Intersection type から scalar metadata を検出するロジック
  - `" $gqlkitScalar"` プロパティの存在をチェック
  - metadata の `name` プロパティから GraphQL scalar 名を取得
  - metadata の `only` プロパティから用途制限を取得
  - TypeChecker API を使用して型情報を走査
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.3 型エイリアス連鎖の追跡
  - 型エイリアスを再帰的に辿って元の scalar metadata を検出
  - 複数段階の連鎖でも正しく動作することを保証
  - パフォーマンスへの影響を最小限に抑える
  - _Requirements: 16.1, 16.2, 16.3_

- [x] 2.4 Nullable / List との組み合わせ処理
  - `| null` union から nullable を検出し、null を除外して scalar を特定
  - 配列型から list of scalar を検出
  - `(T | null)[]` と `T[] | null` のパターンを正しく処理
  - union 走査時に null を除外して metadata を検出
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 2.5 異なる scalar の union エラー検出
  - `Int | IDString` のような異なる scalar の union を検出
  - エラーメッセージに各 scalar 名を含める
  - GraphQL で表現できない型の使用を早期に防止
  - _Requirements: 11.1, 11.2_

- [x] 2.6 Built-in scalar との衝突回避
  - ユーザーが String, Boolean, Float, Int, ID と同名の型を定義してもエラーにしない
  - built-in scalar 検出は TypeScript プリミティブと runtime 提供型のみで行う
  - _Requirements: 14.1, 14.2_

- [x] 3. Type Extractor に ScalarCollector を実装
- [x] 3.1 sourceDir からの custom scalar 収集
  - scalar metadata 付き型の export を検出
  - 同一 scalar 名に対する複数の TypeScript 型を収集
  - DefineScalar と設定ファイル両方からの定義をマージ
  - _Requirements: 5.1, 5.2_

- [x] 3.2 Input/Output 型パラメータの構築
  - `only` なしの型を input/output 両方として扱う
  - `only: "input"` の型を input 用として収集
  - `only: "output"` の複数型を union として output 用に構築
  - `only` なしと `only: "output"` の混在時に両方を output union に含める
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 3.3 Input 型の複数マッピングエラー検出
  - 同一 scalar に `only: "input"` が複数定義された場合にエラー
  - 同一 scalar に `only` なしが複数定義された場合にエラー
  - `only` なしと `only: "input"` の混在をエラー
  - エラーメッセージに競合する型名と定義場所を含める
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 3.4 Input/Output 型の不足エラー検出
  - custom scalar に output 用の型がない場合にエラー
  - custom scalar に input 用の型がない場合にエラー
  - 不足している用途（input/output）を明示したエラーメッセージ
  - _Requirements: 13.1, 13.2, 13.3_

- [x] 4. (P) Config Loader に新形式 scalar 設定を実装
- [x] 4.1 (P) 新しい scalars 設定形式のパース
  - `name` と `tsType.name` の読み込み
  - `tsType.from` によるモジュール指定（省略時はグローバル型）
  - `only` オプションの処理
  - `description` オプションの処理
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.2 DefineScalar と設定ファイルの両立
  - 両方で定義された scalar を有効な型マッピングとして扱う
  - マッピングの競合がない限り両方を保持
  - _Requirements: 6.6_

- [x] 5. Resolver Extractor に OnlyValidator を実装
- [x] 5.1 Input position での only: "output" 違反検出
  - input type のフィールドで output-only 型の使用をエラー
  - resolver の引数型での output-only 型の使用をエラー
  - actionable なエラーメッセージを生成
  - _Requirements: 10.1, 10.2_

- [x] 5.2 Output position での only: "input" 違反検出
  - object type のフィールドで input-only 型の使用をエラー
  - resolver の返り値型での input-only 型の使用をエラー
  - actionable なエラーメッセージを生成
  - _Requirements: 10.3, 10.4_

- [x] 6. Schema Generator に Description 収集と Scalar AST 生成を実装
- [x] 6.1 (P) TSDoc コメントからの description 抽出
  - scalar metadata 付き型の TSDoc コメントを取得
  - 設定ファイルの description フィールドも収集
  - _Requirements: 9.1, 9.4_

- [x] 6.2 (P) 複数 description の結合
  - 複数の description を空行区切りで結合
  - ファイルパス alphabetical 順でソート
  - 同一ファイル内では登場順を維持
  - _Requirements: 9.2, 9.3_

- [x] 6.3 Custom scalar の AST 生成
  - ScalarTypeDefinitionNode を生成
  - description を AST に設定
  - built-in scalar の定義は生成しない
  - _Requirements: 5.1, 5.2_

- [x] 7. Gen Orchestrator に createResolvers 関数生成を実装
- [x] 7.1 Custom scalar 用の createResolvers 関数生成
  - `scalars` 引数を持つ関数シグネチャを生成
  - 各 scalar に対して `GraphQLScalarType<TInput, TOutput>` 型を要求
  - input 型と output 型の union を正しく型パラメータに設定
  - _Requirements: 7.1, 7.2_

- [x] 7.2 Custom scalar なしの場合の関数生成
  - 引数なしの `createResolvers()` 関数を生成
  - Query, Mutation resolver のみを含む Resolvers オブジェクトを返す
  - _Requirements: 7.3_

- [x] 7.3 Resolvers オブジェクトへの scalar resolver 統合
  - 生成された関数が scalar resolver を Resolvers に含めるようにする
  - Query, Mutation と共に scalar resolver を返す
  - _Requirements: 7.4_

- [x] 8. 既存機能との互換性確認と統合テスト
- [x] 8.1 既存 resolver 定義方法の互換性確認
  - defineQuery, defineMutation, defineField が引き続き動作することを確認
  - 既存の `" $gqlkitResolver "` metadata パターンの認識を維持
  - _Requirements: 17.1, 17.2_

- [x] 8.2 設定ファイルの互換性確認
  - 新形式 scalars 設定が正しく読み込まれることを確認
  - _Requirements: 17.3_

- [x] 8.3 エラーメッセージの品質確認
  - 全ての scalar 関連エラーにファイルパスと行番号が含まれることを確認
  - 問題の具体的内容が出力されることを確認
  - 修正方法のヒントが含まれることを確認
  - _Requirements: 18.1, 18.2, 18.3_

- [x] 8.4 Golden file テストの作成
  - scalar-metadata-basic: 基本的な metadata 検出のテストケース
  - scalar-input-output-split: input/output 分離パターンのテストケース
  - scalar-config-mapping: 設定ファイルマッピングのテストケース
  - scalar-errors: 各種エラーケースのテストケース
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.5, 3.6, 4.2, 4.3, 4.4, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 14.1, 14.2, 15.1, 15.2, 15.3, 15.4, 15.5, 16.1, 16.2, 16.3, 17.1, 17.2, 17.3, 18.1, 18.2, 18.3_

---

## Fix Tasks (Implementation Gaps)

> The following tasks address implementation gaps discovered during code review. See `z/scalar-metadata-issues.md` for detailed analysis.

- [x] 9. DefineScalar Metadata 検出の修正
  - DefineScalar で定義した型の metadata が正しく検出されていない問題を修正
  - input/output 分離パターン（input 1つ + output 複数）が正しく処理されるよう修正
  - scalar-input-output-split テストケースが成功するよう実装を修正
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.4_

- [x] 10. (P) Legacy 設定形式の削除
  - `LegacyScalarMappingConfig` 型とその関連コードを完全に削除
  - `ScalarMappingConfig` は新形式のみをサポートする型に変更
  - custom-scalar-config テストケースを新形式に更新または削除
  - design.md の breaking change 方針に準拠
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. (P) 設定ファイルでのグローバル型マッピング実装
  - `tsType.from` が省略された場合にグローバル型（Date 等）としてマッピングする機能を実装
  - scalar-config-mapping テストケースが成功するよう期待値を更新
  - グローバル型が正しく GraphQL scalar に変換されることを検証
  - _Requirements: 6.3_

- [x] 12. Scalar 検証エラー検出の実装
- [x] 12.1 複数 input 型エラー検出の実装
  - 同一 scalar に対して複数の input 用型が定義された場合のエラー検出を実装
  - `only: "input"` 複数、`only` なし複数、両者混在の各パターンを検出
  - エラーメッセージに競合する型名と定義場所を含める
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 12.2 input/output 型不足エラー検出の実装
  - custom scalar に output 用の型がない場合のエラー検出を実装
  - custom scalar に input 用の型がない場合のエラー検出を実装
  - scalar-errors テストケースの期待値をエラー出力に更新
  - _Requirements: 13.1, 13.2, 13.3_

- [x] 13. createResolvers 関数への scalars 引数追加
  - custom scalar が存在する場合に `{ scalars: {...} }` 引数を要求する関数シグネチャを生成
  - 各 scalar に対して `GraphQLScalarType<TInput, TOutput>` 型を型パラメータとして設定
  - 生成される Resolvers オブジェクトに scalar resolver を含める
  - scalar-metadata-basic テストケースの期待値を更新
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 14. Scalar の TSDoc Description 抽出実装
  - scalar metadata 付き型の TSDoc コメントを description として抽出する機能を実装
  - 複数の型がある場合は空行区切りで結合（ファイルパス alphabetical 順）
  - 設定ファイルの description との結合も対応
  - scalar-metadata-basic テストケースの期待値を description 付きに更新
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 15. Golden File テスト期待値の最終更新
- [x] 15.1 scalar-input-output-split テストケースの修正
  - diagnostics.json を削除（成功ケースなのでエラーは出ない）
  - schema.graphql, resolvers.ts, typeDefs.ts を正しい期待値に更新
  - input/output 型の分離が正しく反映されることを確認
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 15.2 scalar-config-mapping テストケースの修正
  - diagnostics.json を削除（成功ケースなのでエラーは出ない）
  - グローバル型マッピングが正しく動作する期待値を設定
  - _Requirements: 6.3_

- [x] 15.3 scalar-errors テストケースの修正
  - 成功出力ファイル（schema.graphql, resolvers.ts, typeDefs.ts）を削除
  - diagnostics.json に複数 input 型エラーと output 型不足エラーを設定
  - エラーメッセージが actionable であることを確認
  - _Requirements: 12.1, 12.4, 13.1, 13.3, 18.1, 18.2, 18.3_

- [x] 15.4 scalar-metadata-basic テストケースの修正
  - resolvers.ts を scalars 引数付きの createResolvers 関数に更新
  - schema.graphql と typeDefs.ts に TSDoc description を追加
  - _Requirements: 7.1, 7.2, 9.1_
