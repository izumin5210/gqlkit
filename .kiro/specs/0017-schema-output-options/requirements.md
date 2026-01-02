# Requirements Document

## Introduction

このドキュメントは `gqlkit gen` コマンドのスキーマ出力オプション機能の要件を定義する。現在 GraphQL スキーマ AST のみを出力しているが、SDL (Schema Definition Language) 形式での出力機能を追加し、出力形式と出力先を柔軟に制御できるようにする。また、出力前に未使用の型を削除する pruning 機能も追加する。

## Requirements

### Requirement 1: SDL 形式でのスキーマ出力

**Objective:** As a 開発者, I want GraphQL スキーマを SDL 形式 (schema.graphql) で出力したい, so that スキーマレビューやドキュメント生成が容易になる

#### Acceptance Criteria
1. When `gqlkit gen` コマンドが実行されたとき, the gqlkit shall 生成されたスキーマを SDL 形式のファイルとして出力する
2. The gqlkit shall SDL ファイルに全ての型定義、フィールド、引数、ディレクティブを含める
3. The gqlkit shall TSDoc から抽出されたドキュメンテーションコメントを SDL 内の description として出力する

### Requirement 2: AST 形式でのスキーマ出力の継続サポート

**Objective:** As a 開発者, I want 既存の AST 出力形式も引き続き利用したい, so that 既存のビルドフローとの互換性を維持できる

#### Acceptance Criteria
1. The gqlkit shall 従来通り GraphQL スキーマ AST (DocumentNode) を TypeScript ファイルとして出力する
2. The gqlkit shall AST 出力と SDL 出力を同時に生成できる

### Requirement 3: 出力パスの設定

**Objective:** As a 開発者, I want AST と SDL の出力先パスを個別に設定したい, so that プロジェクトの構成に合わせた出力先を指定できる

#### Acceptance Criteria
1. The gqlkit shall AST ファイルの出力パスを設定するオプションを提供する
2. The gqlkit shall SDL ファイルの出力パスを設定するオプションを提供する
3. When 出力パスが明示的に指定されなかったとき, the gqlkit shall デフォルトの出力パスを使用する
4. When 出力パスオプションに null が明示的に指定されたとき, the gqlkit shall その形式の出力を抑制する

### Requirement 4: 出力抑制の制御

**Objective:** As a 開発者, I want 不要な出力形式を抑制したい, so that 必要なファイルのみを生成してビルド成果物を最小化できる

#### Acceptance Criteria
1. When AST 出力パスに null が指定されたとき, the gqlkit shall AST ファイルを出力しない
2. When SDL 出力パスに null が指定されたとき, the gqlkit shall SDL ファイルを出力しない
3. While 両方の出力パスが null でないとき, the gqlkit shall 両形式のファイルを出力する

### Requirement 5: 未使用型の自動削除 (Pruning)

**Objective:** As a 開発者, I want 出力されるスキーマから未使用の型を自動的に削除したい, so that スキーマを最小限に保ちレビューを容易にできる

#### Acceptance Criteria
1. When スキーマ出力の直前, the gqlkit shall graphql-tools の pruneSchema を適用して未使用の型を削除する
2. The gqlkit shall Query、Mutation、Subscription から参照されていない型を未使用とみなす
3. The gqlkit shall pruning 後のスキーマを AST と SDL の両形式に適用する
