# Requirements Document

## Project Description (Input)
gqlkit gen コマンドに extractor, generator をつなぎこみファイルを書き出すところまで実装したい

## Introduction

本ドキュメントは、gqlkit gen コマンドの統合機能に関する要件を定義する。既存の type-extractor、resolver-extractor、schema-generator モジュールを gen コマンドに接続し、TypeScript ソースコードから GraphQL スキーマ AST とリゾルバマップを生成してファイルに出力する機能を実装する。

## Requirements

### Requirement 1: ディレクトリスキャン

**Objective:** As a 開発者, I want gen コマンドが規約に基づいたディレクトリを自動的にスキャンすること, so that 設定なしでソースファイルを発見できる

#### Acceptance Criteria
1. When gen コマンドが実行された時, the gqlkit shall `src/gql/types/` ディレクトリ内の全ての TypeScript ファイルを検出する
2. When gen コマンドが実行された時, the gqlkit shall `src/gql/resolvers/` ディレクトリ内の全ての TypeScript ファイルを検出する
3. If 指定されたディレクトリが存在しない場合, the gqlkit shall 明確なエラーメッセージを表示する
4. The gqlkit shall `.ts` 拡張子を持つファイルのみをスキャン対象とする

### Requirement 2: 型抽出の統合

**Objective:** As a 開発者, I want gen コマンドが type-extractor を使用してソースコードから型情報を抽出すること, so that TypeScript 型定義が GraphQL 型に変換される

#### Acceptance Criteria
1. When types ディレクトリのスキャンが完了した時, the gqlkit shall type-extractor を呼び出して型情報を抽出する
2. When 型抽出が実行された時, the gqlkit shall 抽出された型情報(interface, object, union, enum)を取得する
3. If 型抽出中に診断メッセージが発生した場合, the gqlkit shall 全ての診断メッセージを収集する

### Requirement 3: リゾルバ抽出の統合

**Objective:** As a 開発者, I want gen コマンドが resolver-extractor を使用してリゾルバ情報を抽出すること, so that リゾルバ実装が GraphQL リゾルバマップに変換される

#### Acceptance Criteria
1. When resolvers ディレクトリのスキャンが完了した時, the gqlkit shall resolver-extractor を呼び出してリゾルバペアを抽出する
2. When リゾルバ抽出が実行された時, the gqlkit shall Query, Mutation, および型リゾルバのペアを取得する
3. If リゾルバ抽出中に診断メッセージが発生した場合, the gqlkit shall 全ての診断メッセージを収集する

### Requirement 4: スキーマ生成の統合

**Objective:** As a 開発者, I want gen コマンドが schema-generator を使用してコードを生成すること, so that 統合された型とリゾルバからスキーマコードが生成される

#### Acceptance Criteria
1. When 型抽出とリゾルバ抽出が完了した時, the gqlkit shall schema-generator を呼び出してコードを生成する
2. When スキーマ生成が実行された時, the gqlkit shall typeDefs コード(GraphQL スキーマ AST)を生成する
3. When スキーマ生成が実行された時, the gqlkit shall resolvers コード(リゾルバマップ)を生成する

### Requirement 5: ファイル出力

**Objective:** As a 開発者, I want 生成されたコードがファイルに書き出されること, so that 生成されたスキーマをプロジェクトで使用できる

#### Acceptance Criteria
1. When スキーマ生成が成功した時, the gqlkit shall `src/gqlkit/generated/` ディレクトリに出力ファイルを作成する
2. When typeDefs コードが生成された時, the gqlkit shall `schema.ts` ファイルに typeDefs を書き出す
3. When resolvers コードが生成された時, the gqlkit shall `resolvers.ts` ファイルにリゾルバマップを書き出す
4. If 出力ディレクトリが存在しない場合, the gqlkit shall ディレクトリを自動的に作成する
5. The gqlkit shall 既存のファイルを上書きして更新する

### Requirement 6: エラーハンドリング

**Objective:** As a 開発者, I want エラーが発生した場合に適切なフィードバックを受けること, so that 問題を迅速に特定して修正できる

#### Acceptance Criteria
1. If 抽出または生成中にエラーが発生した場合, the gqlkit shall 全てのエラー診断をコンソールに表示する
2. If 重大なエラーが存在する場合, the gqlkit shall ファイル出力をスキップする
3. When エラーが表示される時, the gqlkit shall ファイル名、行番号、列番号を含む位置情報を表示する
4. If エラーなしで完了した場合, the gqlkit shall 成功メッセージを表示する
5. When 処理が完了した時, the gqlkit shall エラーの有無に応じた終了コードを返す

### Requirement 7: 進捗表示

**Objective:** As a 開発者, I want 処理の進捗状況が表示されること, so that コマンドが正常に動作していることを確認できる

#### Acceptance Criteria
1. When 各処理フェーズが開始される時, the gqlkit shall 現在のフェーズ名を表示する
2. When ファイルが正常に書き出された時, the gqlkit shall 出力ファイルパスを表示する
