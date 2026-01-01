# Requirements Document

## Project Description (Input)
custom scalar の設定をしたい。ユーザが gqlkit.config.ts のような設定ファイルを作成できるようにした上で、そこから braned type と graphql custom scalar の対応を追加できるようにしたい

## Introduction

gqlkit は現在、組み込みの branded scalar types（`IDString`, `IDNumber`, `Int`, `Float`）を `@gqlkit-ts/runtime` から提供している。しかし、ユーザーは独自の branded type を定義し、それを GraphQL の custom scalar（例: `DateTime`, `UUID`, `URL` など）にマッピングする手段を持っていない。

本機能は、設定ファイル `gqlkit.config.ts` を導入し、ユーザーが branded type と GraphQL custom scalar の対応関係を宣言的に定義できるようにする。これにより、gqlkit の「型からスキーマを自動生成する」コンセプトを維持しつつ、カスタムスカラーの柔軟なサポートを実現する。

## Requirements

### Requirement 1: 設定ファイルの読み込み
**Objective:** As a gqlkit ユーザー, I want プロジェクトルートに配置した設定ファイルを gqlkit が自動的に認識してほしい, so that 追加のコマンドライン引数なしでカスタム設定を適用できる

#### Acceptance Criteria
1. When `gqlkit gen` コマンドを実行した際にプロジェクトルートに `gqlkit.config.ts` が存在する場合, the CLI shall 設定ファイルを自動的に読み込んで設定を適用する
2. When `gqlkit.config.ts` が存在しない場合, the CLI shall デフォルト設定で動作を継続する
3. When `gqlkit.config.ts` に構文エラーがある場合, the CLI shall エラーメッセージを表示して終了する
4. The CLI shall `gqlkit.config.ts` ファイル形式のみをサポートする（TypeScript ファイルとして）

### Requirement 2: カスタムスカラーマッピングの定義
**Objective:** As a gqlkit ユーザー, I want 自分で定義した branded type を GraphQL custom scalar にマッピングしたい, so that 型安全性を保ちながら独自のスカラー型を利用できる

#### Acceptance Criteria
1. The 設定ファイル shall `scalars` プロパティでカスタムスカラーマッピングの配列を定義できる構造を提供する
2. The 各マッピング定義 shall GraphQL スカラー名とそれに対応する TypeScript の型情報（インポートパスと型名）を含む
3. When マッピングが定義された場合, the Schema Generator shall 対応する branded type を指定された GraphQL custom scalar 型として出力する
4. The 設定 shall 複数のカスタムスカラーマッピングを同時に定義できる

### Requirement 3: スキーマ生成への統合
**Objective:** As a gqlkit ユーザー, I want 設定したカスタムスカラーが生成される GraphQL スキーマに正しく反映されてほしい, so that カスタムスカラーを使用した型安全な GraphQL API を構築できる

#### Acceptance Criteria
1. When カスタムスカラーマッピングが設定されている場合, the Schema Generator shall 対応する GraphQL scalar 定義を typeDefs に含める
2. When 型定義でマッピングされた branded type が使用されている場合, the Schema Generator shall フィールドの型を設定されたカスタムスカラー名で出力する
3. The Schema Generator shall 組み込みの branded scalar types（`IDString`, `IDNumber`, `Int`, `Float`）とカスタムスカラーマッピングを共存させる
4. If 同じ branded type に対して複数のマッピングが定義されている場合, the CLI shall 重複エラーを報告して終了する

### Requirement 4: 設定のバリデーション
**Objective:** As a gqlkit ユーザー, I want 設定ファイルの誤りを早期に検出したい, so that 問題のある設定で生成を実行することを防げる

#### Acceptance Criteria
1. When 設定ファイルに必須プロパティが欠けている場合, the CLI shall 欠けているプロパティを明示したエラーメッセージを表示する
2. When 設定ファイルに不正な型の値が含まれている場合, the CLI shall 期待される型を明示したエラーメッセージを表示する
3. When マッピングで指定された TypeScript 型が見つからない場合, the CLI shall 型が見つからないことを示すエラーメッセージを表示する
4. If 組み込みスカラー名（`ID`, `String`, `Int`, `Float`, `Boolean`）がカスタムスカラーとして定義された場合, the CLI shall 組み込みスカラーの上書きは許可されていないことを示すエラーを報告する

### Requirement 5: 型安全な設定 API
**Objective:** As a gqlkit ユーザー, I want 設定ファイルを記述する際に TypeScript の型補完を受けたい, so that 設定ミスを減らし効率的に設定できる

#### Acceptance Criteria
1. The `@gqlkit-ts/cli` パッケージ shall 設定ファイルの型定義（`GqlkitConfig` など）をエクスポートする
2. The 設定型定義 shall `scalars` プロパティの構造を含む
3. The `@gqlkit-ts/cli` パッケージ shall 設定オブジェクトを作成するためのヘルパー関数（`defineConfig` など）を提供する
4. When ユーザーが `defineConfig` 関数を使用する場合, the TypeScript コンパイラ shall 設定オブジェクトの型チェックと補完を提供する
