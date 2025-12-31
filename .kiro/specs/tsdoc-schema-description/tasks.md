# Implementation Plan

## Task 1. TSDocParser ユーティリティの実装

- [x] 1.1 TSDoc コメントからの description 抽出機能を実装する
  - TypeScript Symbol から documentation comment を取得する機能を構築する
  - `@description` タグまたは本文から description テキストを抽出する
  - 複数行コメントの改行を保持したまま処理する
  - 空白のみの description は undefined として扱う
  - _Requirements: 1.3, 1.4, 1.5, 2.4, 5.1, 5.2_

- [x] 1.2 (P) @deprecated タグの抽出機能を実装する
  - TSDoc 内の `@deprecated` タグを検出する
  - deprecated の reason 文字列を抽出する
  - reason がない場合は isDeprecated のみを設定する
  - _Requirements: 5.3, 5.4_

- [x] 1.3 (P) description 対象外タグのフィルタリングを実装する
  - `@param`、`@returns` 等の記法を description から除外する
  - コメント先頭・末尾の空白と `*` プレフィックスを適切に除去する
  - _Requirements: 5.5, 5.2_

- [x] 1.4 (P) @privateRemarks タグの除外機能を実装する
  - TSDoc 内の `@privateRemarks` タグを検出する
  - `@privateRemarks` タグの内容を description から除外する
  - `@privateRemarks` のみのコメントは undefined として扱う
  - _Requirements: 5.6_

## Task 2. 型定義からの description 抽出

- [x] 2.1 型定義ノードの description 抽出を TypeExtractor に追加する
  - オブジェクト型・インターフェース型の宣言から TSDoc を取得する
  - Union 型の宣言から TSDoc を取得する
  - TSDoc が存在しない場合は description を省略する
  - 抽出した description を既存の TypeMetadata 構造に追加する
  - Depends on: 1.1, 1.2, 1.3, 1.4
  - _Requirements: 1.1, 1.2_

- [x] 2.2 フィールドプロパティの description 抽出を追加する
  - オブジェクト型の各プロパティから TSDoc を取得する
  - インターフェース型の各プロパティから TSDoc を取得する
  - フィールドに TSDoc がない場合は省略する
  - 抽出した description を FieldDefinition 構造に追加する
  - Depends on: 1.1, 1.2, 1.3, 1.4
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2.3 Enum メンバーの description 抽出を追加する
  - Enum の各メンバーから TSDoc を取得する
  - 抽出した description を EnumMemberInfo 構造に追加する
  - Depends on: 1.1, 1.2, 1.3, 1.4
  - _Requirements: 1.1, 2.1_

## Task 3. リゾルバからの description 抽出

- [x] 3.1 Define API リゾルバの description 抽出を DefineAPIExtractor に追加する
  - `defineQuery` エクスポート変数宣言の TSDoc を取得する
  - `defineMutation` エクスポート変数宣言の TSDoc を取得する
  - `defineField` エクスポート変数宣言の TSDoc を取得する
  - TSDoc がない場合は description を省略する
  - 抽出した description を DefineApiResolverInfo 構造に追加する
  - Depends on: 1.1, 1.2, 1.3, 1.4
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3.2 リゾルバ引数の description 抽出を追加する
  - インライン型リテラルで定義された引数プロパティから TSDoc を取得する
  - 別途定義された型（type/interface）を参照する引数から TSDoc を取得する
  - インライン型リテラルと参照型定義の両方に TSDoc がある場合はインラインを優先する
  - 引数に TSDoc がない場合は省略する
  - 抽出した description を ArgumentDefinition 構造に追加する
  - Depends on: 1.1, 1.2, 1.3, 1.4
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Task 4. Description の統合と AST 生成

- [x] 4.1 DescriptionMerger による型とリゾルバの description 統合を実装する
  - 型定義とリゾルバの両方に description がある場合はリゾルバを優先する
  - 型定義のみに description がある場合はそれを使用する
  - リゾルバのみに description がある場合はそれを使用する
  - deprecated 情報も同様の優先順位で統合する
  - Depends on: 2.1, 2.2, 2.3, 3.1, 3.2
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.2 GraphQL AST への description 設定を ASTBuilder に追加する
  - ObjectTypeDefinitionNode に description プロパティを設定する
  - FieldDefinitionNode に description プロパティを設定する
  - EnumValueDefinitionNode に description プロパティを設定する
  - InputObjectTypeDefinitionNode に description プロパティを設定する
  - 複数行 description を StringValueNode として適切に構築する
  - Depends on: 4.1
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 4.3 (P) @deprecated ディレクティブの生成を ASTBuilder に追加する
  - deprecated フラグがある場合に @deprecated ディレクティブを付与する
  - reason がある場合は引数として設定する
  - FieldDefinitionNode と EnumValueDefinitionNode に対応する
  - Depends on: 4.1
  - _Requirements: 5.3, 5.4_

- [x] 4.4 (P) 引数への description 設定を ASTBuilder に追加する
  - InputValueDefinitionNode に description プロパティを設定する
  - 引数の deprecated ディレクティブにも対応する
  - Depends on: 4.1
  - _Requirements: 6.1, 6.2, 6.3_

## Task 5. 統合テストと検証

- [x] 5.1 End-to-end スキーマ生成テストを追加する
  - TSDoc 付き型定義からスキーマが正しく生成されることを検証する
  - TSDoc 付きリゾルバからスキーマが正しく生成されることを検証する
  - TSDoc 付き引数からスキーマが正しく生成されることを検証する
  - 型とリゾルバ両方に TSDoc がある場合の優先順位を検証する
  - インライン引数と参照型引数の優先順位を検証する
  - deprecated ディレクティブが正しく出力されることを検証する
  - @privateRemarks の内容が出力に含まれないことを検証する
  - 複数行 description の改行が保持されることを検証する
  - Depends on: 4.2, 4.3, 4.4
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4_

- [x] 5.2 既存スキーマ生成機能との互換性を確認する
  - TSDoc コメントがない既存コードが正常に処理されることを検証する
  - パフォーマンスへの影響がないことを確認する
  - Depends on: 5.1
  - _Requirements: 1.2, 2.3, 3.4, 6.3_
