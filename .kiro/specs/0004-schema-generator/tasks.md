# Implementation Plan

## Task 1: 型とリゾルバの統合処理

- [x] 1.1 統合型の基本構造を実装する
  - type-extractor と resolver-extractor の結果を入力として受け取る
  - 統合結果を格納するデータ構造を定義する
  - 診断情報の収集・伝播機能を実装する
  - _Requirements: 6.2_

- [x] 1.2 Query/Mutation 型の統合機能を実装する
  - 依存タスク: 1.1
  - resolver-extractor の queryFields から Query 型を生成する
  - resolver-extractor の mutationFields から Mutation 型を生成する
  - フィールドが空の場合は対応する型を生成しない
  - フィールドに引数定義がある場合は引数情報を保持する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.3 型拡張の検証と分離出力を実装する
  - 依存タスク: 1.1
  - typeExtensions の targetTypeName が存在することを検証する
  - 存在しない型への参照時にエラー診断を生成する
  - base types と type extensions を分離して構造化する
  - _Requirements: 3.1, 3.2_

- [x] 1.4 エラー診断の検証と伝播を実装する
  - 依存タスク: 1.1
  - 入力に含まれる既存の診断エラーを伝播する
  - 型参照が解決できない場合に場所情報を含むエラーを生成する
  - severity: "error" の診断時にコード生成をスキップするフラグを設定する
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Task 2: GraphQL スキーマ AST の構築

- [x] 2.1 (P) AST ノード生成のヘルパー機能を実装する
  - graphql-js の Kind 定数を使用した AST ノード生成関数を作成する
  - NameNode, NamedTypeNode, ListTypeNode, NonNullTypeNode の生成を実装する
  - InputValueDefinitionNode の生成を実装する
  - _Requirements: 1.6_

- [x] 2.2 フィールド型の変換機能を実装する
  - 依存タスク: 2.1
  - nullable フィールドを NonNullType でラップしない形式で出力する
  - non-nullable フィールドを NonNullType でラップして出力する
  - リスト型フィールドを ListType でラップして出力する
  - ネストしたリスト・nullable の組み合わせを正しく変換する
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 2.3 型定義ノードの生成機能を実装する
  - 依存タスク: 2.2
  - BaseType から ObjectTypeDefinitionNode を生成する
  - BaseType から UnionTypeDefinitionNode を生成する
  - TypeExtension から ObjectTypeExtensionNode を生成する
  - FieldDefinitionNode を引数付きで生成する
  - _Requirements: 1.1, 1.2, 3.1_

- [x] 2.4 DocumentNode の組み立てと決定論的ソートを実装する
  - 依存タスク: 2.3
  - すべての型定義を DocumentNode にまとめる
  - 型定義を名前順でソートする
  - 各型内のフィールドを名前順でソートする
  - _Requirements: 1.6, 7.1, 7.2_

## Task 3: Resolver Map 情報の構築

- [x] 3.1 (P) リゾルバ情報のデータ構造を実装する
  - import 情報を格納する構造を定義する
  - 型別のリゾルバフィールド情報を格納する構造を定義する
  - _Requirements: 4.4_

- [x] 3.2 リゾルバの分類と収集機能を実装する
  - 依存タスク: 3.1
  - Query リゾルバを Query オブジェクトとして分類する
  - Mutation リゾルバを Mutation オブジェクトとして分類する
  - 型拡張リゾルバを対応する型名でグループ化する
  - 空のリゾルバグループは出力に含めない
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3.3 import パス解決機能を実装する
  - 依存タスク: 3.2
  - 出力ディレクトリからリゾルバソースファイルへの相対パスを計算する
  - 各リゾルバ実装への参照を維持する
  - キーを一貫した順序で出力する
  - _Requirements: 4.4, 4.5, 7.3_

## Task 4: TypeScript コード生成と出力

- [x] 4.1 typeDefs 出力機能を実装する
  - 依存タスク: 2.4
  - DocumentNode を TypeScript コードとして出力する
  - DocumentNode 型の export を生成する
  - ESM 互換の import/export 構文を使用する
  - _Requirements: 5.1, 5.4_

- [x] 4.2 resolvers 出力機能を実装する
  - 依存タスク: 3.3
  - リゾルバソースからの import 文を生成する
  - resolver map オブジェクトを export として生成する
  - graphql-tools 互換の形式で出力する
  - _Requirements: 5.2, 5.4, 5.5_

- [x] 4.3 ファイル出力と決定論的生成を実装する
  - 依存タスク: 4.1, 4.2
  - 指定された出力ディレクトリにファイルを書き込む
  - 出力ディレクトリが存在しない場合は作成する
  - 同一入力からバイト単位で同一の出力を生成する
  - 改行コードを LF で統一する
  - _Requirements: 5.3, 7.4_

## Task 5: 統合とエントリポイント

- [x] 5.1 スキーマ生成のエントリポイントを実装する
  - 依存タスク: 1.4, 4.3
  - type-extractor と resolver-extractor の結果を受け取る
  - 各コンポーネントを順番に呼び出すパイプラインを構築する
  - エラー診断がある場合はコード生成をスキップする
  - 生成結果と診断情報を返す
  - _Requirements: 6.3_

- [x] 5.2 統合テストを実装する
  - 依存タスク: 5.1
  - 完全な type-extractor + resolver-extractor 出力からのスキーマ生成を検証する
  - 空の Query/Mutation ケースの処理を検証する
  - typeExtension が extend type 構文で出力されることを検証する
  - エラー診断時のスキップ動作を検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_
