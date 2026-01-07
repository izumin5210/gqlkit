# Implementation Plan

## Task 1. Runtime 層のディレクティブ型定義

- [x] 1.1 (P) `DirectiveLocation` 型を実装する
  - GraphQL 仕様に準拠した Type System Directive Location を表す文字列リテラル型を定義する
  - SCHEMA、SCALAR、OBJECT、FIELD_DEFINITION、ARGUMENT_DEFINITION、INTERFACE、UNION、ENUM、ENUM_VALUE、INPUT_OBJECT、INPUT_FIELD_DEFINITION を含める
  - `@gqlkit-ts/runtime` パッケージからエクスポートする
  - _Requirements: 1.4, 1.5_

- [x] 1.2 (P) `Directive` ユーティリティ型を 3 パラメータに拡張する
  - `Directive<Name, Args, Location>` の 3 パラメータ形式に拡張する
  - `Name` を文字列リテラル型、`Args` を `Record<string, unknown>` を継承する型、`Location` を `DirectiveLocation` または配列として扱う
  - Phantom type パターンにより型情報のみを保持し、実行時オーバーヘッドなしで動作する
  - 既存の 2 パラメータ版との後方互換性を維持する（Location にデフォルト値を設定）
  - `@gqlkit-ts/runtime` パッケージからエクスポートする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.3 (P) `WithDirectives` ユーティリティ型を実装する
  - 任意の型にディレクティブメタデータを付与する交差型を定義する
  - 複数のディレクティブを配列として受け付ける
  - ` $gqlkitDirectives` プロパティとしてメタデータを埋め込む（既存の `$gqlkitScalar` パターンを踏襲）
  - Optional property により実行時の値は不要とする
  - `@gqlkit-ts/runtime` パッケージからエクスポートする
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.4 リゾルバ定義 API の型シグネチャを拡張する
  - `defineQuery` の型パラメータにディレクティブ情報を受け付けるパラメータを追加する
  - `defineMutation` の型パラメータにディレクティブ情報を受け付けるパラメータを追加する
  - `defineField` の型パラメータにディレクティブ情報を受け付けるパラメータを追加する
  - 3 番目の型パラメータとして `WithDirectives` でラップした型を指定できるようにする
  - 既存のリゾルバ定義との後方互換性を維持する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## Task 2. ディレクティブ使用検出モジュールの実装

- [x] 2.1 ディレクティブメタデータ検出の基盤を実装する
  - `DirectiveInfo`、`DirectiveArgument`、`DirectiveArgumentValue` の型定義を作成する
  - TypeScript 型から ` $gqlkitDirectives` プロパティを検出するロジックを実装する
  - 検出結果とエラーを含む `DirectiveDetectionResult` を返すインターフェースを定義する
  - `shared` ディレクトリ配下に配置し、type-extractor と resolver-extractor から共有する
  - _Requirements: 5.3, 5.4_

- [x] 2.2 ディレクティブ引数値の解決機能を実装する
  - 文字列リテラル型から string 値を解決する
  - 数値リテラル型から number 値を解決する
  - boolean リテラル型から true/false 値を解決する
  - 文字列 enum メンバーから enum 値を解決する
  - タプル・配列リテラル型から list 値を再帰的に解決する
  - オブジェクトリテラル型から object 値を解決する
  - _Requirements: 5.5_

- [x] 2.3 ディレクティブ使用のバリデーションとエラー診断を実装する
  - ディレクティブ名が空文字列の場合にエラーを報告する
  - 引数値が型情報から解決できない場合にエラーを報告する
  - 診断メッセージにファイルパスと行番号を含める
  - 既存の Diagnostic 形式に統合する
  - _Requirements: 9.1, 9.2, 9.5_

## Task 3. ディレクティブ定義抽出モジュールの実装

- [x] 3.1 ディレクティブ定義抽出の基盤を実装する
  - `DirectiveDefinitionInfo`、`DirectiveArgumentDefinition` の型定義を作成する
  - エクスポートされた型エイリアスから `Directive<Name, Args, Location>` の使用を検出するロジックを実装する
  - ディレクティブ名（Name）、引数型（Args）、適用場所（Location）を抽出する
  - `shared` ディレクトリ配下に `directive-definition-extractor` として配置する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3.2 ジェネリック型ディレクティブの引数構造解析を実装する
  - 型パラメータの制約から引数型の構造を推論する
  - 単純リスト型（`R extends string[]`）を `[String!]!` として解析する
  - nullable 要素を含むリスト型を適切に解析する
  - ネストした配列型を再帰的に処理する
  - カスタム型参照（enum、input type）を解決する
  - 解決不能な型（unbounded ジェネリック）に対してエラーを報告する
  - _Requirements: 4.5_

## Task 4. 型抽出器へのディレクティブ抽出統合

- [x] 4.1 (P) 型レベルのディレクティブ使用抽出を統合する
  - `GraphQLTypeInfo` に `directives` フィールドを追加する
  - `WithDirectives` でラップされた型定義からディレクティブを抽出する
  - DirectiveDetector を使用してディレクティブ情報を取得する
  - 既存の型抽出フローに統合する
  - _Requirements: 5.1_

- [x] 4.2 (P) フィールドレベルのディレクティブ使用抽出を統合する
  - `FieldInfo` に `directives` フィールドを追加する
  - フィールドの型に `WithDirectives` が適用されている場合にディレクティブを抽出する
  - 複数のディレクティブが付与されている場合に順序を保持して抽出する
  - 既存のフィールド抽出処理に統合する
  - _Requirements: 5.2, 5.4_

- [x] 4.3 ディレクティブ定義の収集を型抽出フローに統合する
  - `TypeExtractionResult` に `directiveDefinitions` フィールドを追加する
  - DirectiveDefinitionExtractor を使用して型エイリアスからディレクティブ定義を収集する
  - 既存の型抽出フローに統合する
  - _Requirements: 4.1_

## Task 5. リゾルバ抽出器へのディレクティブ抽出統合

- [x] 5.1 (P) リゾルバ定義からのディレクティブ使用抽出を実装する
  - `DefineApiResolverInfo` に `directives` フィールドを追加する
  - `defineQuery` の型引数からディレクティブ情報を抽出する
  - `defineMutation` の型引数からディレクティブ情報を抽出する
  - `defineField` の型引数からディレクティブ情報を抽出する
  - 3 番目の型パラメータが指定されている場合のみディレクティブを抽出する
  - 抽出したディレクティブ情報を対応するフィールドに関連付ける
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Task 6. 結果統合と Location バリデーション

- [x] 6.1 ディレクティブ定義の統合結果への追加を実装する
  - `IntegratedResult` に `directiveDefinitions` フィールドを追加する
  - 型抽出結果からディレクティブ定義を統合処理に受け渡す
  - _Requirements: 7.5_

- [x] 6.2 ディレクティブ使用場所のバリデーションを実装する
  - ディレクティブ使用場所と定義された Location の整合性を検証する
  - 型定義に付与されたディレクティブは `OBJECT` または `INPUT_OBJECT` で使用可能
  - フィールドに付与されたディレクティブは `FIELD_DEFINITION` または `INPUT_FIELD_DEFINITION` で使用可能
  - 使用場所が定義された Location に含まれない場合に `INVALID_DIRECTIVE_LOCATION` エラーを生成する
  - _Requirements: 9.3_

- [x] 6.3 未サポート Location と未定義ディレクティブの診断を実装する
  - 未サポートの Location（SCHEMA、SCALAR、INTERFACE、UNION、ENUM）で定義されたディレクティブに対して `UNSUPPORTED_DIRECTIVE_LOCATION` エラーを生成する
  - 使用されているディレクティブに対応する定義が見つからない場合に `UNDEFINED_DIRECTIVE` 警告を生成する
  - 診断メッセージにディレクティブの使用箇所（ファイル、行番号）を含める
  - _Requirements: 9.3, 9.4, 9.5_

## Task 7. ディレクティブ定義のスキーマ生成

- [x] 7.1 ディレクティブ定義から AST ノードへの変換を実装する
  - `DirectiveDefinitionInfo` から `DirectiveDefinitionNode` への変換ロジックを実装する
  - ディレクティブ引数の型を `InputValueDefinitionNode` として出力する
  - locations を `NameNode` の配列として出力する
  - repeatable は常に `false` として設定する
  - description が存在する場合は `StringValueNode` として出力する
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7.2 ディレクティブ定義をスキーマ出力に統合する
  - `buildDocumentNode` でディレクティブ定義を処理する
  - ディレクティブ定義をスキーマ内の型定義より前に配置する
  - 複数のディレクティブ定義を適切に順序付けて出力する
  - _Requirements: 7.5_

## Task 8. ディレクティブ使用のスキーマ出力

- [x] 8.1 ディレクティブ引数値から GraphQL AST ノードへの変換を実装する
  - `DirectiveArgumentValue` から `ConstValueNode` への変換ロジックを実装する
  - 文字列値を `StringValueNode` に変換する
  - 数値を `IntValueNode` または `FloatValueNode` に変換する
  - boolean 値を `BooleanValueNode` に変換する
  - enum 値を `EnumValueNode` に変換する
  - リスト値を `ListValueNode` に再帰的に変換する
  - オブジェクト値を `ObjectValueNode` に変換する
  - _Requirements: 8.4_

- [x] 8.2 ディレクティブノード生成と型定義への出力を実装する
  - `DirectiveInfo` から `ConstDirectiveNode` への変換関数を実装する
  - ディレクティブ引数を GraphQL の引数形式で出力する
  - 複数のディレクティブを定義順に出力する
  - 型定義（Object Type、Input Type など）へのディレクティブ出力を実装する
  - _Requirements: 8.1, 8.5_

- [x] 8.3 フィールド定義へのディレクティブ出力を実装する
  - オブジェクト型のフィールドにディレクティブを出力する
  - Query フィールドにディレクティブを出力する
  - Mutation フィールドにディレクティブを出力する
  - 既存の `buildDeprecatedDirective` パターンを一般化して統合する
  - _Requirements: 8.2, 8.3_

## Task 9. 統合テスト

- [x] 9.1 基本的なディレクティブ機能の golden file テストを追加する
  - 型レベルディレクティブの基本ケースを追加する
  - フィールドレベルディレクティブの基本ケースを追加する
  - リゾルバへのディレクティブ付与ケースを追加する
  - 型抽出からスキーマ生成までの E2E フローを検証する
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3_

- [x] 9.2 ディレクティブ引数の各種型パターンの golden file テストを追加する
  - 文字列引数のケースを追加する
  - 数値引数のケースを追加する
  - boolean 引数のケースを追加する
  - enum 引数のケースを追加する
  - 配列引数のケースを追加する
  - オブジェクト引数のケースを追加する
  - _Requirements: 5.5, 8.4_

- [x] 9.3 複数ディレクティブと順序保持の golden file テストを追加する
  - 複数ディレクティブの付与と順序保持を検証する
  - _Requirements: 2.3, 5.4, 8.5_

- [x] 9.4 ディレクティブ使用バリデーションエラーの golden file テストを追加する
  - 空のディレクティブ名エラーのケースを追加する
  - 解決不能な引数値エラーのケースを追加する
  - 診断メッセージの位置情報が正確であることを検証する
  - _Requirements: 9.1, 9.2, 9.5_

- [x] 9.5 ディレクティブ定義のスキーマ生成テストを追加する
  - 基本的なディレクティブ定義の生成を検証する
  - 複数の Location を持つディレクティブ定義を検証する
  - 引数を持つディレクティブ定義を検証する
  - ディレクティブ定義がスキーマ内の適切な位置に出力されることを検証する
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9.6 ジェネリック型ディレクティブ引数のテストを追加する
  - 単純リスト型の引数を検証する
  - nullable 要素を含むリスト型の引数を検証する
  - カスタム型参照（enum、input type）の引数を検証する
  - 解決不能な型に対するエラー報告を検証する
  - _Requirements: 4.5_

- [x] 9.7 Location バリデーションエラーのテストを追加する
  - ディレクティブの使用場所と定義された Location の不一致エラーを検証する
  - `INVALID_DIRECTIVE_LOCATION` エラーメッセージを検証する
  - _Requirements: 9.3_

- [x] 9.8 未サポート Location エラーのテストを追加する
  - SCHEMA、SCALAR、INTERFACE、UNION、ENUM への使用に対するエラーを検証する
  - `UNSUPPORTED_DIRECTIVE_LOCATION` エラーメッセージを検証する
  - _Requirements: 9.3_

- [x] 9.9 未定義ディレクティブ警告のテストを追加する
  - 定義が見つからないディレクティブの使用に対する警告を検証する
  - `UNDEFINED_DIRECTIVE` 警告メッセージを検証する
  - _Requirements: 9.4_
