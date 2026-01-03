# Implementation Plan

## Tasks

- [x] 1. 設定型定義を拡張する
- [x] 1.1 出力設定とメイン設定の型を追加する
  - 出力パス設定用のインターフェースを定義する（resolversPath, typeDefsPath, schemaPath）
  - メイン設定インターフェースに sourceDir, sourceIgnoreGlobs, output フィールドを追加する
  - すべての新規フィールドをオプショナルとして定義する
  - null 値による出力抑制をサポートする型を定義する
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. 設定バリデーションを実装する
- [x] 2.1 (P) ソースディレクトリのバリデーションを追加する
  - sourceDir が空文字列でないことを検証するロジックを実装する
  - 無効な値に対して診断メッセージを生成する
  - _Requirements: 1.3_

- [x] 2.2 (P) 除外パターンのバリデーションを追加する
  - sourceIgnoreGlobs が文字列の配列であることを検証する
  - 配列以外の値に対してエラーを報告する
  - glob パターン形式の妥当性を検証する
  - _Requirements: 4.2, 4.3_

- [x] 2.3 (P) 出力パス設定のバリデーションを追加する
  - 各出力パス（resolversPath, typeDefsPath, schemaPath）が文字列、null、または未定義であることを検証する
  - 無効な型に対して診断メッセージを生成する
  - _Requirements: 5.4, 5.5, 5.6_

- [x] 3. 設定ローダーのデフォルト値適用を実装する
- [x] 3.1 ソースディレクトリのデフォルト値を適用する
  - sourceDir が未指定の場合に `src/gqlkit` をデフォルトとして設定する
  - 設定ファイルの値を優先して使用する
  - _Requirements: 1.1, 1.2_

- [x] 3.2 除外パターンのデフォルト値を適用する
  - sourceIgnoreGlobs が未指定の場合に空配列をデフォルトとして設定する
  - _Requirements: 4.1_

- [x] 3.3 出力パスのデフォルト値を適用する
  - resolversPath のデフォルトを `src/gqlkit/__generated__/resolvers.ts` に設定する
  - typeDefsPath のデフォルトを `src/gqlkit/__generated__/typeDefs.ts` に設定する
  - schemaPath のデフォルトを `src/gqlkit/__generated__/schema.graphql` に設定する
  - null 指定による出力抑制を維持する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. ファイルスキャナーを拡張する
- [x] 4.1 (P) TypeScript ソースファイルの判定ロジックを実装する
  - `.ts`, `.cts`, `.mts` ファイルを解析対象として認識する
  - `.d.ts` などの型定義ファイルを除外する
  - _Requirements: 2.1_

- [x] 4.2 (P) ディレクトリの再帰的走査を実装する
  - 指定されたソースディレクトリ以下を再帰的にスキャンする
  - Node.js 標準 API（fs.glob）を使用してファイルを収集する
  - _Requirements: 2.2_

- [x] 4.3 glob パターンによる除外を実装する
  - 設定された除外パターンにマッチするファイルを解析対象から除外する
  - path.matchesGlob を使用してパターンマッチングを行う
  - 複数の除外パターンを組み合わせて適用する
  - _Requirements: 4.4_

- [x] 4.4 出力ディレクトリの自動除外を実装する
  - 出力先ファイルパスを解析対象から自動的に除外する
  - 出力先がソースディレクトリ外の場合は除外処理をスキップする
  - 各出力ファイル（resolvers, typeDefs, schema）を個別に除外対象とする
  - _Requirements: 3.1, 3.2_

- [x] 5. オーケストレーターを統合スキャンに移行する
- [x] 5.1 単一ソースディレクトリからの型・リゾルバ抽出に移行する
  - 分離されていた types/resolvers のスキャンを統合する
  - 同一のファイルセットから型定義とリゾルバ定義を同時に抽出する
  - _Requirements: 2.3_

- [x] 5.2 新しい設定構造を適用する
  - 設定から解決されたパスを使用してファイルスキャンを実行する
  - 除外設定をファイルスキャナーに渡す
  - 出力パス設定をファイルライターに渡す
  - _Requirements: 7.1, 7.2_

- [x] 6. gen コマンドからハードコードされたパスを削除する
  - 旧パス構成（`src/gql/types/`, `src/gql/resolvers/`, `src/gqlkit/generated/`）の参照を削除する
  - 設定ローダーから取得した解決済みパスを使用する
  - 設定がない場合は新しいデフォルト値が適用されることを確認する
  - _Requirements: 7.1, 7.2_

- [x] 7. サンプルプロジェクトを新パス構成に移行する
- [x] 7.1 (P) full-featured サンプルを移行する
  - `gqlkit.config.ts` に sourceDir を設定して既存構造を維持
  - 新しい出力パス設定形式に更新
  - _Requirements: 7.3_

- [x] 7.2 (P) minimal サンプルを移行する
  - `gqlkit.config.ts` を新規作成して sourceDir を設定
  - 新しい出力パス設定形式に更新
  - _Requirements: 7.3_

- [x] 8. テストを新パス構成に更新する
- [x] 8.1 ゴールデンファイルテストを更新する
  - `gen-orchestrator/testdata/` のテストケースを新ディレクトリ構成に移行する
  - 新しいデフォルトパスを反映した expected 出力を更新する
  - 統合スキャンのテストケースを追加する
  - _Requirements: 7.1, 7.2_

- [x] 8.2 設定バリデーションのテストを追加する
  - sourceDir, sourceIgnoreGlobs, output のバリデーションテストを作成する
  - エラーケースと正常ケースをカバーする
  - _Requirements: 1.3, 4.2, 4.3, 5.4, 5.5, 5.6_

- [x] 8.3 ファイルスキャナーのテストを追加する
  - glob 除外パターンのテストを作成する
  - 出力ディレクトリ除外のテストを作成する
  - TypeScript ファイル判定のテストを作成する
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.4_
