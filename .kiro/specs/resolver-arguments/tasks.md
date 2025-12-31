# Implementation Plan

## Task Summary

- **Total**: 4 major tasks, 12 sub-tasks
- **Requirements coverage**: 6 requirements (1-6) fully mapped
- **Parallel tasks**: Tasks 2 and 3 can run concurrently after Task 1 completion

---

## Tasks

- [x] 1. 型システム基盤の拡張
- [x] 1.1 GraphQLTypeKind と型情報の拡張
  - GraphQL 型種別に Input Object を追加し、型分類の基盤を整備する
  - 型情報に Input Object であることを示すフラグを追加する
  - 既存の Object 型との区別を明確にする
  - _Requirements: 1.2, 1.3_

- [x] 1.2 Input Type 分類ロジックの実装
  - 型名が `Input` で終わるオブジェクト型を自動的に Input Object として識別する
  - 抽出された型情報に分類結果のメタデータを付与する
  - 分類結果を GraphQL 型変換処理に渡す
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.3 Input 命名規則のエラーハンドリング
  - `Input` で終わる名前がオブジェクト型以外（union、interface 等）に使われた場合にエラーを検出する
  - エラーメッセージにソースファイル位置情報を含める
  - Diagnostic 形式でエラーを報告する
  - _Requirements: 1.4, 6.4_

- [x] 1.4 IntegratedResult のデータモデル拡張
  - 統合結果に Input Object 型のコレクションを追加する
  - Input Object 型のフィールド情報（名前、型、null 許容性）を保持する構造を定義する
  - Result Integrator で Input Object 型を収集・格納する
  - _Requirements: 1.3, 4.1_

- [x] 2. 引数型の検証機能
- [x] 2.1 (P) 引数型の参照検証
  - 引数型が既知の型（スカラー、Enum、Input Object）を参照していることを検証する
  - 未知の型への参照をエラーとして検出する
  - Input Object 内のフィールドが Output 型を参照していないことを検証する
  - エラーメッセージに型名と参照元の情報を含める
  - _Requirements: 6.1, 6.3_

- [x] 2.2 (P) 循環参照検出機能
  - Input Object 間の循環参照を検出するアルゴリズムを実装する
  - 深さ優先探索で参照パスを追跡する
  - 循環参照が検出された場合、参照パスを含むエラーメッセージを生成する
  - _Requirements: 6.2_

- [x] 2.3 (P) 複数エラーの収集と報告
  - 検出した全てのエラーを収集し、まとめて報告する仕組みを実装する
  - 各エラーにソースファイルパスと行番号を付与する
  - 既存の Diagnostic パターンと統合する
  - _Requirements: 6.4, 6.5_

- [x] 3. Input Object 型定義とフィールド引数の生成
- [x] 3.1 (P) Input Object 型定義の AST 生成
  - Input Object 型から GraphQL `input` 型定義ノードを生成する
  - フィールドの名前、型、null 許容性を正しく反映する
  - ネストした Input Object 型への参照を適切に生成する
  - フィールド名をアルファベット順でソートする
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3.2 (P) フィールド引数定義の生成強化
  - リゾルバの引数型から GraphQL フィールドに引数定義を生成する
  - Optional プロパティを nullable な引数として、Required プロパティを non-null な引数として生成する
  - 配列型を GraphQL List 型として生成する
  - Input Object 型への参照を適切に解決する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3.3 (P) スカラー型と Enum 型の引数サポート
  - プリミティブ型（string、number、boolean）を対応する GraphQL スカラー型にマッピングする
  - Enum 型を引数として使用可能にする
  - Input Object 型のフィールドでも Enum 型を使用可能にする
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. 統合と E2E 検証
- [x] 4.1 パイプライン統合
  - Type Extractor、Result Integrator、AST Builder の変更を統合する
  - 引数付きリゾルバの情報が正しくパイプラインを通過することを確認する
  - DocumentNode 出力に Input 型定義とフィールド引数が含まれることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.2 E2E テストの実装
  - Input Object 型を含むスキーマ生成の E2E テストを作成する
  - 引数付きリゾルバのスキーマ生成を検証する
  - エラーケース（不正な Input Object 定義）のテストを含める
  - examples ディレクトリでの動作確認を行う
  - _Requirements: 4.5, 6.1, 6.2, 6.3_
