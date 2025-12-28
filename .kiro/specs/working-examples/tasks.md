# Implementation Plan

## Tasks

- [x] 1. examples ディレクトリと共通設定の作成
  - リポジトリルート直下に examples/ ディレクトリを作成
  - 各サンプルで共通利用する tsconfig.json の基本設定を定義
  - gqlkit を親パッケージへの link として参照する設定方針を確立
  - _Requirements: 1.1, 1.2_

- [x] 2. basic-types サンプルの実装
- [x] 2.1 basic-types パッケージの構成
  - examples/basic-types/ ディレクトリを作成
  - package.json に必要な依存関係（gqlkit, graphql, graphql-yoga, @graphql-tools/schema, tsx）を定義
  - pnpm install && pnpm gen && pnpm start で動作するスクリプトを設定
  - _Requirements: 1.3, 1.4, 8.1_

- [x] 2.2 basic-types 型定義とリゾルバの実装
  - プリミティブ型（string, number, boolean）を含む User interface を定義
  - QueryResolver による user, users フィールドをドメイン単位で集約
  - TypeScript interface から GraphQL Object 型への変換パターンを示す
  - 機能に直接関係しないコードを排除し、必要最小限の構成とする
  - _Requirements: 2.1, 2.2, 2.3, 9.1, 9.3_

- [x] 2.3 basic-types サーバーエントリポイントの実装
  - graphql-yoga を使用したサーバー起動コードを作成
  - 生成された typeDefs と resolvers を makeExecutableSchema で統合
  - GraphQL Playground が localhost:4000/graphql で利用可能な状態にする
  - _Requirements: 2.4, 2.5, 8.2, 8.3_

- [x] 3. type-relations サンプルの実装
- [x] 3.1 (P) type-relations パッケージの構成
  - examples/type-relations/ ディレクトリを作成
  - basic-types と同様の package.json および tsconfig.json を設定
  - _Requirements: 1.3, 1.4_

- [x] 3.2 type-relations 型定義とリゾルバの実装
  - User と Post の 2 つの関連する型を定義
  - 各ドメインエンティティごとに QueryResolver を配置
  - 他の GraphQL 型を参照するフィールド（User.posts, Post.author）を含める
  - nullable フィールド（T | null）とリスト型（T[]）の両方を示す
  - フィールドが別の型を参照している場合のスキーマ変換パターンを示す
  - サーバーエントリポイントを basic-types と同様のパターンで作成
  - 依存: 3.1 完了後に実行
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.2, 8.3_

- [x] 4. field-arguments サンプルの実装
- [x] 4.1 (P) field-arguments パッケージの構成
  - examples/field-arguments/ ディレクトリを作成
  - 必要な依存関係と設定ファイルを配置
  - _Requirements: 1.3, 1.4_

- [x] 4.2 field-arguments 型定義とリゾルバの実装
  - 引数を持つ QueryResolver をドメイン単位で定義
  - 複数の引数を持つフィールド（limit, offset）を示す
  - nullable な引数と non-nullable な引数の両方を含める
  - args 型がオブジェクト型として InputValueDefinition に変換されるパターンを示す
  - サーバーエントリポイントを作成
  - 依存: 4.1 完了後に実行
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.2, 8.3_

- [x] 5. type-extensions サンプルの実装
- [x] 5.1 (P) type-extensions パッケージの構成
  - examples/type-extensions/ ディレクトリを作成
  - 必要な依存関係と設定ファイルを配置
  - _Requirements: 1.3, 1.4_

- [x] 5.2 type-extensions 型定義とリゾルバの実装
  - User と Post の基本型を定義
  - QueryResolver と UserResolver をドメイン単位で集約
  - Post 関連の QueryResolver を別ファイルに配置
  - UserResolver による計算フィールド（fullName など）を定義
  - {TypeName}Resolver と {typeName}Resolver の命名規則を示す
  - parent 引数を受け取るフィールドリゾルバパターンを示す
  - 拡張フィールドが extend type として出力されることを確認できる構成にする
  - サーバーエントリポイントを作成
  - 依存: 5.1 完了後に実行
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.2, 8.3_

- [x] 6. enums サンプルの実装
- [x] 6.1 (P) enums パッケージの構成
  - examples/enums/ ディレクトリを作成
  - 必要な依存関係と設定ファイルを配置
  - _Requirements: 1.3, 1.4_

- [x] 6.2 enums 型定義とリゾルバの実装
  - TypeScript enum（Status）を定義
  - string literal union（Role）を定義
  - enum を参照するフィールドを持つ User 型を定義
  - QueryResolver をドメイン単位で配置
  - SCREAMING_SNAKE_CASE 変換が正しく行われることを確認できる構成にする
  - サーバーエントリポイントを作成
  - 依存: 6.1 完了後に実行
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.2, 8.3_

- [x] 7. mutations サンプルの実装
- [x] 7.1 (P) mutations パッケージの構成
  - examples/mutations/ ディレクトリを作成
  - 必要な依存関係と設定ファイルを配置
  - _Requirements: 1.3, 1.4_

- [x] 7.2 mutations 型定義とリゾルバの実装
  - QueryResolver と MutationResolver をドメイン単位で集約
  - MutationResolver による Mutation フィールド（createUser, updateUser, deleteUser）を定義
  - 引数を持つ Mutation フィールドを示す
  - 戻り値型を持つ Mutation フィールドを示す
  - resolvers.Mutation が正しく出力されることを確認できる構成にする
  - サーバーエントリポイントを作成
  - 依存: 7.1 完了後に実行
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.2, 8.3_

- [x] 8. README ドキュメントの作成
- [x] 8.1 examples 全体の README を作成
  - examples/ 直下に README.md を作成
  - 各サンプルの概要と目的を記載
  - 全体的な実行手順（pnpm install, pnpm gen, pnpm start）を記載
  - _Requirements: 8.4, 9.3_

- [x] 8.2 (P) 各サンプルの README を作成
  - 各サンプルディレクトリに README.md を作成
  - サンプル固有の機能説明を記載
  - 実行手順と確認用クエリ例を記載
  - _Requirements: 8.4, 9.3_

- [x] 9. 全サンプルの動作検証と最終調整
  - 各サンプルで pnpm install && pnpm gen && pnpm start が正常に動作することを確認
  - 生成された schema.ts と resolvers.ts が正しく出力されることを確認
  - GraphQL Playground でクエリ実行が可能であることを確認
  - ボイラープレートの重複を最小化し、最終的なコード品質を確認
  - _Requirements: 8.1, 8.2, 8.3, 9.2, 9.4_
