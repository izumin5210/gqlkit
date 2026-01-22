# Implementation Plan

## Tasks

- [x] 1. Payload 型名生成のための naming-convention 拡張
- [x] 1.1 (P) ResolverPayloadContext 型とペイロード命名ロジックの追加
  - 返り値のインライン型用に `resolverPayload` コンテキストを追加
  - Query/Mutation の場合は `${PascalCase<fieldName>}Payload` 形式で命名
  - Field resolver の場合は `${ParentTypeName}${PascalCase<fieldName>}Payload` 形式で命名
  - ネストした型の場合は `${PayloadTypeName}${PascalCase<fieldName>}` 形式で命名（Input サフィックスなし）
  - 既存の `generateAutoTypeName()` に新しいコンテキストケースを追加
  - _Requirements: 1.1, 2.1, 2.2, 3.2, 3.3, 4.2, 4.3, 5.1, 5.2, 5.3_

- [x] 2. 返り値インライン型情報の抽出基盤
- [x] 2.1 (P) GraphQLFieldDefinition への返り値インライン型フィールド追加
  - 返り値のインラインオブジェクトプロパティ用フィールドを追加
  - 返り値のインライン Enum メンバー用フィールドを追加
  - 返り値のインライン Union メンバー用フィールドを追加
  - 外部 Enum シンボル参照用フィールドを追加
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.2 define-api-extractor での返り値インライン型プロパティ抽出
  - `convertDefineApiToFields()` で返り値型からインラインオブジェクトプロパティを抽出
  - 返り値型からインライン Enum メンバー（文字列リテラルユニオン）を抽出
  - 返り値型からインライン Union メンバー（名前付き型ユニオン）を抽出
  - ユーティリティ型（Omit, Pick など）でラップされた型を展開してインライン型として処理
  - TSDoc コメントを返り値型から抽出
  - _Requirements: 6.2, 6.3, 7.1, 7.2, 7.3_

- [x] 3. 返り値からのインライン型収集機能
- [x] 3.1 (P) inline-enum-collector への Payload コンテキスト対応追加
  - resolver 返り値から文字列リテラルユニオンを検出する機能を追加
  - Payload オブジェクト型内にネストした文字列リテラルユニオンも収集
  - `resolverPayload` コンテキストを収集結果に付与
  - _Requirements: 4.1, 5.2_

- [x] 3.2 (P) inline-union-collector への Payload コンテキスト対応追加
  - resolver 返り値から名前付き型ユニオンを検出する機能を追加
  - Payload オブジェクト型内にネストした名前付き型ユニオンも収集
  - 出力コンテキスト用に `isInputContext: false` を設定
  - `resolverPayload` コンテキストを収集結果に付与
  - _Requirements: 3.1, 5.3_

- [x] 4. auto-type-generator での Payload 型生成
- [x] 4.1 resolver 返り値からのインラインオブジェクト収集
  - `collectInlinePayloadsFromResolvers()` 関数を実装
  - Query, Mutation, Field resolver の返り値からインラインオブジェクトを検出
  - `knownTypeNames` に含まれる型は収集をスキップ
  - _Requirements: 1.1, 2.1, 6.1_

- [x] 4.2 Payload オブジェクト型の生成
  - 収集したインラインオブジェクトから GraphQL Object 型を生成
  - Non-Null フィールドには `!` を付与
  - 配列型フィールドには適切な List 型を適用
  - 既存の型変換ルール（スカラー型、branded 型、参照型）を適用
  - _Requirements: 1.2, 1.3, 1.4, 2.3_

- [x] 4.3 Payload Enum 型の生成
  - 文字列リテラルユニオンから GraphQL Enum 型を生成
  - 文字列リテラル値を SCREAMING_SNAKE_CASE に変換
  - TypeScript 文字列リテラルと GraphQL Enum 値のマッピングを生成
  - _Requirements: 4.4, 4.5_

- [x] 4.4 Payload Union 型の生成
  - 名前付き型ユニオンから GraphQL Union 型を生成
  - Union メンバーとして各名前付き型を含める
  - _Requirements: 3.4_

- [x] 4.5 ネストしたインライン型の再帰的処理
  - Payload オブジェクト型のフィールド内にネストしたインラインオブジェクトを再帰的に収集
  - ネストの深さに関係なく全てのインライン型を処理
  - 親子参照の整合性を維持
  - _Requirements: 5.1, 5.4, 5.5_

- [x] 4.6 TSDoc コメントの GraphQL description への反映
  - インラインオブジェクト型のプロパティ TSDoc をフィールド description に変換
  - インラインオブジェクト型自体の TSDoc を型 description に変換
  - `@deprecated` タグを GraphQL `@deprecated` ディレクティブに変換
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 4.7 resolver 返り値型参照の更新
  - `updateResolversResult()` を拡張して返り値型の参照を生成された型名に更新
  - 元のインライン型定義を生成された Payload 型への参照に置換
  - _Requirements: 2.3_

- [x] 5. Golden File テストケースの作成
- [x] 5.1 (P) Query/Mutation Payload 型生成テスト
  - Query 返り値のインラインオブジェクトが `${QueryName}Payload` として生成されることを検証
  - Mutation 返り値のインラインオブジェクトが `${MutationName}Payload` として生成されることを検証
  - Non-Null フィールドと List 型フィールドの変換を検証
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5.2 (P) Field Resolver Payload 型生成テスト
  - Field resolver 返り値のインラインオブジェクトが `${ParentType}${FieldName}Payload` として生成されることを検証
  - 親型名がそのまま維持されることを検証
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.3 (P) Union Payload 型生成テスト
  - 名前付き型ユニオンが GraphQL Union 型として生成されることを検証
  - Query/Mutation と Field resolver それぞれの命名規則を検証
  - Union メンバーが正しく含まれることを検証
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5.4 (P) Enum Payload 型生成テスト
  - 文字列リテラルユニオンが GraphQL Enum 型として生成されることを検証
  - SCREAMING_SNAKE_CASE 変換を検証
  - Enum 値マッピングの生成を検証
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5.5 (P) ネスト型の再帰的処理テスト
  - ネストしたインラインオブジェクトが再帰的に処理されることを検証
  - ネストした Enum と Union が正しく生成されることを検証
  - 深いネストでも正しく動作することを検証
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.6 (P) knownTypeNames による自動生成スキップテスト
  - 既存の名前付き型が使用された場合に自動生成されないことを検証
  - 既存型への参照が維持されることを検証
  - _Requirements: 6.1_

- [x] 5.7 (P) ユーティリティ型展開テスト
  - Omit, Pick などでラップされた型がインラインオブジェクトとして展開されることを検証
  - 2-phase 型抽出の動作を検証
  - _Requirements: 6.2, 6.3_

- [x] 5.8 (P) TSDoc コメント継承テスト
  - プロパティの TSDoc がフィールド description に反映されることを検証
  - 型の TSDoc が型 description に反映されることを検証
  - _Requirements: 7.1, 7.2_

- [x] 5.9 (P) @deprecated ディレクティブ変換テスト
  - `@deprecated` タグが GraphQL `@deprecated` ディレクティブに変換されることを検証
  - _Requirements: 7.3_

- [x] 5.10 (P) 型名競合エラーテスト
  - 生成される Payload 型名が既存型名と競合した場合のエラー出力を検証
  - アクション可能なエラーメッセージが表示されることを検証
  - _Requirements: 1.1, 2.1_
