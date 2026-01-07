# Implementation Plan

## Task 1. Runtime 層のディレクティブ型定義

- [x] 1.1 (P) `Directive` ユーティリティ型を実装する
  - ディレクティブの名前と引数を型安全に表現するジェネリック型を定義する
  - 名前は文字列リテラル型、引数は `Record<string, unknown>` を継承する制約を持つ
  - Phantom type パターンにより型情報のみを保持し、実行時オーバーヘッドなしで動作する
  - `@gqlkit-ts/runtime` パッケージからエクスポートする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 (P) `WithDirectives` ユーティリティ型を実装する
  - 任意の型にディレクティブメタデータを付与する交差型を定義する
  - 複数のディレクティブを配列として受け付ける
  - ` $gqlkitDirectives` プロパティとしてメタデータを埋め込む（既存の `$gqlkitScalar` パターンを踏襲）
  - Optional property により実行時の値は不要とする
  - `@gqlkit-ts/runtime` パッケージからエクスポートする
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.3 リゾルバ定義 API の型シグネチャを拡張する
  - `defineQuery` の型パラメータにディレクティブ情報を受け付けるパラメータを追加する
  - `defineMutation` の型パラメータにディレクティブ情報を受け付けるパラメータを追加する
  - `defineField` の型パラメータにディレクティブ情報を受け付けるパラメータを追加する
  - 3番目の型パラメータとして `WithDirectives` でラップした型を指定できるようにする
  - 既存のリゾルバ定義との後方互換性を維持する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## Task 2. ディレクティブ検出モジュールの実装

- [x] 2.1 ディレクティブメタデータ検出の基盤を実装する
  - `DirectiveInfo`、`DirectiveArgument`、`DirectiveArgumentValue` の型定義を作成する
  - TypeScript 型から ` $gqlkitDirectives` プロパティを検出するロジックを実装する
  - 検出結果とエラーを含む `DirectiveDetectionResult` を返すインターフェースを定義する
  - `shared` ディレクトリ配下に配置し、type-extractor と resolver-extractor から共有する
  - _Requirements: 4.3, 4.4_

- [x] 2.2 ディレクティブ引数値の解決機能を実装する
  - 文字列リテラル型から string 値を解決する
  - 数値リテラル型から number 値を解決する
  - boolean リテラル型から true/false 値を解決する
  - 文字列 enum メンバーから enum 値を解決する
  - タプル・配列リテラル型から list 値を再帰的に解決する
  - オブジェクトリテラル型から object 値を解決する
  - _Requirements: 4.5_

- [x] 2.3 ディレクティブのバリデーションとエラー診断を実装する
  - ディレクティブ名が空文字列の場合にエラーを報告する
  - 引数値が型情報から解決できない場合にエラーを報告する
  - 診断メッセージにファイルパスと行番号を含める
  - 既存の Diagnostic 形式に統合する
  - _Requirements: 7.1, 7.2, 7.3_

## Task 3. 型抽出器へのディレクティブ抽出統合

- [x] 3.1 (P) 型レベルのディレクティブ抽出を統合する
  - `GraphQLTypeInfo` に `directives` フィールドを追加する
  - `WithDirectives` でラップされた型定義からディレクティブを抽出する
  - DirectiveDetector を使用してディレクティブ情報を取得する
  - 既存の型抽出フローに統合する
  - _Requirements: 4.1_

- [x] 3.2 (P) フィールドレベルのディレクティブ抽出を統合する
  - `FieldInfo` に `directives` フィールドを追加する
  - フィールドの型に `WithDirectives` が適用されている場合にディレクティブを抽出する
  - 複数のディレクティブが付与されている場合に順序を保持して抽出する
  - 既存のフィールド抽出処理に統合する
  - _Requirements: 4.2, 4.4_

## Task 4. リゾルバ抽出器へのディレクティブ抽出統合

- [x] 4.1 (P) リゾルバ定義からのディレクティブ抽出を実装する
  - `DefineApiResolverInfo` に `directives` フィールドを追加する
  - `defineQuery` の型引数からディレクティブ情報を抽出する
  - `defineMutation` の型引数からディレクティブ情報を抽出する
  - `defineField` の型引数からディレクティブ情報を抽出する
  - 3番目の型パラメータが指定されている場合のみディレクティブを抽出する
  - 抽出したディレクティブ情報を対応するフィールドに関連付ける
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

## Task 5. スキーマ生成へのディレクティブ出力統合

- [x] 5.1 ディレクティブ引数値から GraphQL AST ノードへの変換を実装する
  - `DirectiveArgumentValue` から `ConstValueNode` への変換ロジックを実装する
  - 文字列値を `StringValueNode` に変換する
  - 数値を `IntValueNode` または `FloatValueNode` に変換する
  - boolean 値を `BooleanValueNode` に変換する
  - enum 値を `EnumValueNode` に変換する
  - リスト値を `ListValueNode` に再帰的に変換する
  - オブジェクト値を `ObjectValueNode` に変換する
  - _Requirements: 6.4_

- [x] 5.2 ディレクティブノード生成と型定義への出力を実装する
  - `DirectiveInfo` から `ConstDirectiveNode` への変換関数を実装する
  - ディレクティブ引数を GraphQL の引数形式で出力する
  - 複数のディレクティブを定義順に出力する
  - 型定義（Object Type、Input Type など）へのディレクティブ出力を実装する
  - _Requirements: 6.1, 6.5_

- [x] 5.3 フィールド定義へのディレクティブ出力を実装する
  - オブジェクト型のフィールドにディレクティブを出力する
  - Query フィールドにディレクティブを出力する
  - Mutation フィールドにディレクティブを出力する
  - 既存の `buildDeprecatedDirective` パターンを一般化して統合する
  - _Requirements: 6.2, 6.3_

## Task 6. 統合テスト

- [x] 6.1 基本的なディレクティブ機能の golden file テストを追加する
  - 型レベルディレクティブの基本ケースを追加する
  - フィールドレベルディレクティブの基本ケースを追加する
  - リゾルバへのディレクティブ付与ケースを追加する
  - 型抽出からスキーマ生成までの E2E フローを検証する
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

- [x] 6.2 ディレクティブ引数の各種型パターンの golden file テストを追加する
  - 文字列引数のケースを追加する
  - 数値引数のケースを追加する
  - boolean 引数のケースを追加する
  - enum 引数のケースを追加する
  - 配列引数のケースを追加する
  - オブジェクト引数のケースを追加する
  - _Requirements: 4.5, 6.4_

- [x] 6.3 複数ディレクティブと順序保持の golden file テストを追加する
  - 複数ディレクティブの付与と順序保持を検証する
  - _Requirements: 2.3, 4.4, 6.5_

- [x] 6.4 バリデーションエラーの golden file テストを追加する
  - 空のディレクティブ名エラーのケースを追加する
  - 解決不能な引数値エラーのケースを追加する
  - 診断メッセージの位置情報が正確であることを検証する
  - _Requirements: 7.1, 7.2, 7.3_
