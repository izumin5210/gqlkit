# Requirements Document

## Introduction

本機能は、gqlkit CLI の `gen` コマンドにおける TypeScript Program インスタンスの共有と、プロジェクトの tsconfig.json を利用した compilerOptions の設定を実現するものです。現在、type-extractor と resolver-extractor でそれぞれ独立して `createProgram` を呼び出しているため、パフォーマンスの低下を招いています。これを単一の共有 Program インスタンスに統合し、利用プロジェクトの tsconfig.json から compilerOptions を読み込むことで、パフォーマンスを改善しつつ、プロジェクト固有の TypeScript 設定を反映できるようにします。

## Requirements

### Requirement 1: 共有 TypeScript Program インスタンス

**Objective:** 開発者として、TypeScript Program の生成を一度に統合したい。これにより、コード生成のパフォーマンスが向上し、複数の extractor 間で一貫した型解析結果を得られるようになる。

#### Acceptance Criteria

1. When `gen` コマンドが実行されたとき, the gqlkit CLI shall 単一の TypeScript Program インスタンスを生成し、type-extractor および resolver-extractor の両方で共有する
2. The gqlkit CLI shall type-extractor と resolver-extractor の実行時に、それぞれ新しい Program インスタンスを生成しない
3. When 共有 Program インスタンスを使用して型抽出を行うとき, the type-extractor shall 従来と同等の型情報を抽出できる
4. When 共有 Program インスタンスを使用してリゾルバ抽出を行うとき, the resolver-extractor shall 従来と同等のリゾルバ情報を抽出できる

### Requirement 2: tsconfig.json からの compilerOptions 読み込み

**Objective:** 開発者として、プロジェクトの tsconfig.json で定義された compilerOptions を gqlkit の型解析に適用したい。これにより、プロジェクト固有の TypeScript 設定（パスエイリアス、strictness 設定など）が正しく反映される。

#### Acceptance Criteria

1. When `gen` コマンドが実行されたとき, the gqlkit CLI shall カレントディレクトリの `tsconfig.json` を自動的に検索して読み込む
2. When `tsconfig.json` が見つかったとき, the gqlkit CLI shall そのファイルから compilerOptions を抽出し、TypeScript Program の生成に使用する
3. When `tsconfig.json` に `extends` フィールドが存在するとき, the gqlkit CLI shall 継承元の設定を正しく解決して適用する
4. If `tsconfig.json` がカレントディレクトリに存在しないとき, then the gqlkit CLI shall デフォルトの compilerOptions を使用して Program を生成する

### Requirement 3: カスタム tsconfig パスオプション

**Objective:** 開発者として、デフォルトの `tsconfig.json` 以外の設定ファイルを指定したい。これにより、モノレポ環境や特殊なプロジェクト構成でも柔軟に対応できる。

#### Acceptance Criteria

1. When 設定ファイルで `tsconfigPath` オプションが指定されたとき, the gqlkit CLI shall 指定されたパスの tsconfig ファイルを読み込む
2. If 指定された tsconfig ファイルが存在しないとき, then the gqlkit CLI shall エラーメッセージを表示して処理を中断する
3. The gqlkit CLI shall `tsconfigPath` オプションに相対パスまたは絶対パスのいずれも受け付ける

### Requirement 4: 後方互換性

**Objective:** 既存の gqlkit ユーザーとして、今回の変更によって既存のコード生成結果が変わらないことを保証したい。これにより、安心してアップグレードできる。

#### Acceptance Criteria

1. When tsconfigPath オプションを指定せずに `gen` コマンドを実行したとき, the gqlkit CLI shall 従来と同等のスキーマおよびリゾルバマップを生成する
2. The gqlkit CLI shall 既存のテストケースをすべてパスする
3. When `tsconfig.json` が存在しないプロジェクトで実行されたとき, the gqlkit CLI shall 従来と同じデフォルト動作を維持する

