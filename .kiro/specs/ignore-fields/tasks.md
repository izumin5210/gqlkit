# Implementation Plan

## Tasks

- [x] 1. (P) Runtime における ignoreFields 型定義の追加
  - GqlTypeMetaShape インターフェースに ignoreFields プロパティを追加（string 型として定義）
  - GqlObject の Meta 型パラメータで ignoreFields を `keyof T & string` に制約
  - 既存の directives、implements との併用を可能にする
  - 後方互換性を維持しつつメタデータ型を拡張
  - _Requirements: 1.1, 4.1, 4.2, 4.3_

- [x] 2. (P) ignoreFields メタデータ検出機能の実装
  - `$gqlkitTypeMeta` プロパティから ignoreFields の型情報を検出
  - String literal union を解析して除外フィールド名の Set を構築
  - ignoreFields が未指定の場合は null を返却
  - 既存の interface-detector と同様のパターンでメタデータを抽出
  - _Requirements: 1.2_

- [x] 3. (P) ignoreFields バリデーション機能の実装
  - 指定されたフィールド名が型に存在するかを検証
  - 存在しないフィールド名に対してアクショナブルなエラーメッセージを生成（利用可能なフィールド名を含める）
  - 全フィールドが除外される場合のエラー検出
  - 新規エラーコード `IGNORE_FIELD_NOT_FOUND`、`IGNORE_ALL_FIELDS` を定義
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. (P) フィールド抽出における ignoreFields フィルタリングの実装
  - ExtractFieldsParams に ignoreFields パラメータを追加
  - フィールドループ内で ignoreFields.has(propName) によるスキップ処理を実装
  - ignoreFields が null の場合は全フィールドを抽出（既存動作を維持）
  - Object Type と Input Object Type の両方で動作することを確認
  - 除外されたフィールドのリゾルバが生成されないことを確認
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_

- [x] 5. 型抽出パイプラインへの ignoreFields 統合
  - TypeExtractor で ignoreFields 検出を extractFieldsFromType の前に実行
  - 検出した ignoreFields を FieldExtractor に渡してフィルタリング
  - フィルタリング後に IgnoreFieldsValidator でバリデーション実行
  - 既存の InterfaceValidator がフィルタ後のフィールドを検証することを確認
  - Interface の必須フィールドが ignoreFields で除外された場合にエラーが報告されることを確認
  - _Requirements: 5.3, 6.1, 6.2_

- [x] 6. Golden file テストの追加

- [x] 6.1 (P) 正常系テストケースの追加
  - ignore-fields-basic: 基本的な ignoreFields 動作（Object Type）
  - ignore-fields-input: Input Object Type での ignoreFields
  - ignore-fields-with-implements: Interface 実装との併用
  - ignore-fields-with-directives: Directives との併用
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3_

- [x] 6.2 (P) エラー系テストケースの追加
  - ignore-fields-error-unknown-field: 存在しないフィールド名指定時のエラー
  - ignore-fields-error-all-fields: 全フィールド除外時のエラー
  - ignore-fields-error-interface-field: Interface フィールド除外時のエラー
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2_
