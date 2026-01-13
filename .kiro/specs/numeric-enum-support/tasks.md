# Implementation Plan

## Task Summary

本実装計画では、TypeScript の numeric enum を GraphQL enum としてサポートし、数値から文字列への変換リゾルバを自動生成する機能を実現する。

---

- [x] 1. TypeExtractor における Numeric Enum 検出機能の実装
- [x] 1.1 enum メンバー情報に数値を保持するためのデータ構造を拡張する
  - EnumMemberInfo に numeric enum の数値を格納するフィールドを追加
  - GraphQLTypeInfo に enum が numeric かどうかを示すフラグを追加
  - 既存の string enum 処理との互換性を維持
  - _Requirements: 1.2, 1.4_

- [x] 1.2 TypeScript enum が numeric か string かを判定するロジックを実装する
  - enum 宣言から各メンバーの初期化値を解析
  - すべてのメンバーが数値の場合に numeric enum と判定
  - enum メンバー名と数値の組み合わせを抽出して内部データ構造に保持
  - _Requirements: 1.1, 1.2_

- [x] 1.3 混合 enum（numeric と string の混在）を検出してエラーを報告する
  - 一部が数値、一部が文字列のメンバーを持つ enum を検出
  - 明確なエラーメッセージとソース位置情報を含む診断を生成
  - 既存の isHeterogeneousEnum で対応済み
  - _Requirements: 1.3, 6.3_

- [x] 1.4 (P) Numeric enum の値に対するバリデーションを実装する
  - 同一 enum 内での数値の重複を検出してエラー報告
  - GraphQL 識別子として無効な enum メンバー名を検出してエラー報告
  - エラーメッセージにファイル名と行番号を含める
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. (P) Schema Generation における Numeric Enum 対応
- [x] 2.1 Numeric enum から GraphQL enum スキーマを正しく生成する
  - enum メンバー名を GraphQL enum 値として出力
  - TSDoc コメントを GraphQL description として含める
  - @deprecated タグを GraphQL ディレクティブに変換
  - numeric enum と string enum で同一形式のスキーマを生成
  - 既存の enum スキーマ生成ロジックで対応済み
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. ResultIntegrator における自動リゾルバ収集機能の実装
- [x] 3.1 統合結果に numeric enum 情報と自動リゾルバ情報を保持するデータ構造を追加する
  - NumericEnumInfo で enum 名とメンバーの数値マッピングを保持
  - AutoEnumFieldResolver で自動適用すべきフィールド情報を保持
  - nullable および list のフラグを含める
  - _Requirements: 1.4, 4.1_

- [x] 3.2 Object 型および Interface 型のフィールドを走査して numeric enum 参照を収集する
  - 各フィールドの戻り値型が numeric enum かどうかを判定
  - ユーザーが明示的に定義したリゾルバがあるフィールドを除外
  - Object 型と Interface 型の両方を走査対象に含める
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 4. CodeEmitter における変換コード生成機能の実装
- [x] 4.1 Numeric enum ごとに数値から文字列への変換関数を生成する
  - switch 文ベースの変換関数を生成
  - 各 case で数値から対応する enum メンバー名を返す
  - default case で未知の数値に対するエラーをスローする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4.2 Numeric enum を返すフィールドに対する自動リゾルバを生成する
  - 単純なフィールドに対して変換関数を呼び出すリゾルバを生成
  - nullable なフィールドに対して null チェック付きリゾルバを生成
  - 配列フィールドに対して各要素を変換する map 処理付きリゾルバを生成
  - _Requirements: 4.2, 4.3_

- [x] 4.3 生成されたリゾルバを createResolvers 関数に統合する
  - 変換関数をファイル先頭に出力
  - 自動リゾルバをリゾルバマップの適切な位置に配置
  - TypeScript の型安全性を維持した出力
  - graphql-tools の makeExecutableSchema との互換性を確保
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. (P) Verbose モードでの診断出力対応
  - gqlkit gen の verbose モードで検出された numeric enum の一覧を出力
  - enum 名と検出されたメンバー数を表示
  - _Requirements: 6.4_

- [x] 6. Golden File テストによる機能検証
- [x] 6.1 基本的な numeric enum 変換のテストケースを追加する
  - 単純な numeric enum の定義と変換関数の生成を検証
  - 生成される GraphQL スキーマが正しいことを確認
  - numeric-enum-basic テストケースで検証済み
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 3.3, 3.4_

- [x] 6.2 (P) Object 型フィールドへの自動リゾルバ適用のテストケースを追加する
  - Object 型のフィールドが numeric enum を返す場合の自動リゾルバ生成を検証
  - numeric-enum-basic テストケースでカバー済み
  - _Requirements: 4.1_

- [x] 6.3 (P) Nullable フィールドの処理のテストケースを追加する
  - nullable な numeric enum フィールドのリゾルバ生成を検証
  - null 値が正しく処理されることを確認
  - numeric-enum-nullable テストケースを追加
  - _Requirements: 4.2_

- [x] 6.4 (P) 配列フィールドの処理のテストケースを追加する
  - numeric enum の配列を返すフィールドのリゾルバ生成を検証
  - 配列の各要素が変換されることを確認
  - numeric-enum-list テストケースを追加
  - _Requirements: 4.3_

- [x] 6.5 (P) ユーザー定義リゾルバとの共存のテストケースを追加する
  - ユーザーが明示的にリゾルバを定義している場合に自動リゾルバが適用されないことを検証
  - numeric-enum-user-resolver テストケースを追加
  - _Requirements: 4.4_

- [x] 6.6 (P) Interface 型フィールドへの適用のテストケースを追加する
  - Interface 型のフィールドに対しても自動リゾルバが適用されることを検証
  - numeric-enum-interface テストケースを追加
  - _Requirements: 4.5_

- [x] 6.7 (P) 混合 enum エラーのテストケースを追加する
  - numeric と string が混在する enum でエラーが報告されることを検証
  - numeric-enum-error-heterogeneous テストケースを追加
  - _Requirements: 1.3, 6.3_

- [x] 6.8 (P) 重複値エラーのテストケースを追加する
  - 同一 numeric enum 内で値が重複している場合にエラーが報告されることを検証
  - numeric-enum-error-duplicate テストケースを追加
  - _Requirements: 6.1, 6.3_
