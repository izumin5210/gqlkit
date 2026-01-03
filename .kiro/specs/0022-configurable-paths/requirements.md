# Requirements Document

## Introduction
gqlkit の解析対象ディレクトリおよび出力ファイルのパス設定をカスタマイズ可能にする機能を実装する。現在の固定パス（`src/gql/types/`, `src/gql/resolvers/`, `src/gqlkit/generated/`）を、統一的なパス構成に完全移行し、設定ファイルから柔軟に変更できるようにする。

**注意**: 本機能は未リリース段階での仕様変更であり、後方互換性は考慮しない。最適な仕様・実装への完全移行を優先する。

## Requirements

### Requirement 1: 解析対象ディレクトリの設定
**Objective:** As a gqlkit ユーザー, I want 解析対象ディレクトリを設定できるようにしたい, so that プロジェクトの構成に合わせて gqlkit の解析起点を変更できる

#### Acceptance Criteria
1. The gqlkit CLI shall デフォルトで `src/gqlkit` を解析対象ディレクトリとして使用する
2. When ユーザーが `gqlkit.config.ts` で `sourceDir` を指定した場合, the gqlkit CLI shall 指定されたディレクトリを解析対象ディレクトリとして使用する
3. If 指定された解析対象ディレクトリが存在しない場合, the gqlkit CLI shall エラーメッセージを表示して処理を中断する

### Requirement 2: 解析対象ファイルのスコープ
**Objective:** As a gqlkit ユーザー, I want 解析対象ディレクトリ以下のすべての TypeScript ファイルを解析対象にしたい, so that 型定義とリゾルバを自由なディレクトリ構成で配置できる

#### Acceptance Criteria
1. The gqlkit CLI shall 解析対象ディレクトリ以下のすべての `.ts`, `.cts`, `.mts` ファイルを解析対象とする
2. The gqlkit CLI shall 解析対象ディレクトリのサブディレクトリを再帰的に走査する
3. The gqlkit CLI shall 型定義とリゾルバ定義を同一のファイルスキャンで検出する

### Requirement 3: 生成ファイルの除外
**Objective:** As a gqlkit ユーザー, I want gqlkit が生成したファイルが解析対象から除外されるようにしたい, so that 生成コードが解析に影響を与えない

#### Acceptance Criteria
1. The gqlkit CLI shall 出力先ディレクトリ内のファイルを解析対象から自動的に除外する
2. When 出力先が解析対象ディレクトリ外に設定されている場合, the gqlkit CLI shall 解析対象ディレクトリ内のすべてのファイルを解析対象とする

### Requirement 4: 除外パターンの設定
**Objective:** As a gqlkit ユーザー, I want 解析対象から除外するパターンを指定したい, so that テストファイルやユーティリティなど解析不要なファイルを除外できる

#### Acceptance Criteria
1. The gqlkit CLI shall デフォルトでは追加の除外パターンを適用しない（空リスト）
2. When ユーザーが `gqlkit.config.ts` で `sourceIgnoreGlobs` パターンを指定した場合, the gqlkit CLI shall 指定パターンにマッチするファイルを解析対象から除外する
3. The gqlkit CLI shall glob パターン形式で除外パターンを指定可能にする
4. The gqlkit CLI shall 生成ファイルの除外と設定による除外を両方適用する

### Requirement 5: 出力ファイルパスの設定
**Objective:** As a gqlkit ユーザー, I want 生成ファイルの出力先を設定したい, so that プロジェクトの命名規則やディレクトリ構成に合わせられる

#### Acceptance Criteria
1. The gqlkit CLI shall デフォルトで resolver map を `src/gqlkit/__generated__/resolvers.ts` に出力する
2. The gqlkit CLI shall デフォルトで GraphQL schema AST を `src/gqlkit/__generated__/typeDefs.ts` に出力する
3. The gqlkit CLI shall デフォルトで GraphQL schema SDL を `src/gqlkit/__generated__/schema.graphql` に出力する
4. When ユーザーが `gqlkit.config.ts` で `output.resolversPath` を指定した場合, the gqlkit CLI shall 指定パスに resolver map を出力する
5. When ユーザーが `gqlkit.config.ts` で `output.typeDefsPath` を指定した場合, the gqlkit CLI shall 指定パスに GraphQL schema AST を出力する
6. When ユーザーが `gqlkit.config.ts` で `output.schemaPath` を指定した場合, the gqlkit CLI shall 指定パスに GraphQL schema SDL を出力する

### Requirement 6: 設定スキーマの型安全性
**Objective:** As a gqlkit ユーザー, I want 設定ファイルで型補完を受けたい, so that 設定ミスを事前に防げる

#### Acceptance Criteria
1. The `@gqlkit-ts/cli` shall `defineConfig()` の型定義に `sourceDir`, `sourceIgnoreGlobs`, `output` オプションを含める
2. The `defineConfig()` shall すべての新規オプションをオプショナルとして定義する
3. The `defineConfig()` shall `output` を `resolversPath`, `typeDefsPath`, `schemaPath` フィールドを持つオブジェクトとして型定義する

### Requirement 7: 完全移行
**Objective:** As a gqlkit 開発者, I want 旧パス構成を完全に廃止したい, so that コードベースがシンプルになり保守性が向上する

#### Acceptance Criteria
1. The gqlkit CLI shall 旧パス構成（`src/gql/types/`, `src/gql/resolvers/`, `src/gqlkit/generated/`）のサポートを削除する
2. The gqlkit CLI shall 設定がない場合は新しいデフォルト値を使用する
3. The example プロジェクト shall 新しいパス構成に移行する
4. The ドキュメント shall 新しいパス構成を反映する

