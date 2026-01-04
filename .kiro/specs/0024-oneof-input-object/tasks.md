# Implementation Plan

## Task 1. @oneOf 関連診断コードの定義
- [x] 1.1 (P) @oneOf 関連のエラーコードを追加する
  - 空の union に対するエラーコード（少なくとも1つのメンバーが必要）を定義する
  - フィールド名衝突に対するエラーコード（重複するフィールド名を検出）を定義する
  - 非オブジェクト型メンバーに対するエラーコード（全メンバーがオブジェクト型である必要）を定義する
  - inline object literal 型に対するエラーコード（named type 定義を要求）を定義する
  - 各エラーコードにファイルパス・行番号を含む診断情報を出力できるようにする
  - _Requirements: 4.1, 4.2, 1.3, 3.3, 4.4_

## Task 2. Union 型の @oneOf Input Object 認識機能
- [x] 2.1 *Input suffix を持つ union 型を @oneOf Input Object として識別する
  - `*Input` suffix を持つ TypeScript union 型を検出して特別な処理対象とする
  - union のすべてのメンバーがオブジェクト型（type または interface）であることを検証する
  - プリミティブ型や非オブジェクト型がメンバーに含まれる場合は @oneOf として認識しない
  - 検証失敗時は適切なエラーコードで診断情報を生成する
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.2 @oneOf Input Object のフィールド情報を生成する
  - union の各メンバー型をフィールドとして持つ構造を生成する
  - メンバー型名を camelCase に変換してフィールド名とする（例: `Foo` → `foo`）
  - 各フィールドは nullable として設定する（@oneOf のセマンティクス）
  - フィールド名の衝突を検出し、重複がある場合はエラーを報告する
  - _Requirements: 2.1, 2.3, 2.4, 4.2_

## Task 3. Union メンバー型の展開処理
- [x] 3.1 オブジェクト型メンバーの展開処理を実装する
  - union メンバー型がオブジェクト型の場合、そのメンバー型をフィールドの型として使用する
  - メンバー型自身が `*Input` suffix を持つ場合は、別の Input Object Type への参照として生成する
  - _Requirements: 3.1, 3.2_

- [x] 3.2 inline object literal 型の検出とエラー報告を実装する
  - union メンバー型が inline object literal 型の場合、エラーを報告する（`INLINE_OBJECT_NOT_SUPPORTED`）
  - ユーザーに明示的な named type 定義を促すエラーメッセージを出力する
  - 解決できない型参照が含まれる場合もエラーを報告する
  - _Requirements: 3.3, 4.3_

## Task 4. @oneOf directive 付き AST 生成
- [x] 4.1 (P) @oneOf directive のビルダー関数を実装する
  - graphql-js の Kind.DIRECTIVE を使用して `@oneOf` directive ノードを生成する
  - directive ノードを InputObjectTypeDefinitionNode に付与できるようにする
  - _Requirements: 2.2_

- [x] 4.2 @oneOf Input Object の AST 生成を実装する
  - OneOfInputObject 型に対して @oneOf directive 付きの InputObjectTypeDefinitionNode を生成する
  - 全フィールドを nullable（NonNullType でラップしない）として生成する
  - description を適切に設定する
  - _Requirements: 2.2, 2.4_

## Task 5. TSDoc コメントの継承機能
- [x] 5.1 (P) union 型の TSDoc コメント継承を実装する
  - union 型に付与された TSDoc コメントを生成される Input Object Type の description として設定する
  - TSDoc に `@deprecated` タグが含まれる場合は `@deprecated` directive を付与する
  - _Requirements: 5.1, 5.3_

- [x] 5.2 メンバー型の TSDoc コメント継承を実装する
  - union メンバー型に付与された TSDoc コメントを対応するフィールドの description として設定する
  - メンバー型の `@deprecated` タグも同様に directive として継承する
  - _Requirements: 5.2, 5.3_

## Task 6. ゴールデンファイルテストの追加
- [x] 6.1 基本的な @oneOf Input Object のテストケースを追加する
  - 単純な union 型からの @oneOf Input Object 生成を検証する
  - 生成されたスキーマに `@oneOf` directive が含まれることを確認する
  - フィールド名の camelCase 変換が正しく動作することを確認する
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 6.2 (P) ネストした Input Object を含む @oneOf のテストケースを追加する
  - union メンバー型が `*Input` suffix を持つ場合の参照生成を検証する
  - inline object literal 型を含む union に対するエラー出力を検証する
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6.3 (P) TSDoc 付き @oneOf のテストケースを追加する
  - union 型と各メンバー型の TSDoc コメントが description として継承されることを検証する
  - `@deprecated` タグが directive として正しく継承されることを検証する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6.4 (P) エラーケースのテストを追加する
  - 空の union 型に対するエラーが正しく報告されることを検証する
  - フィールド名衝突に対するエラーが正しく報告されることを検証する
  - 非オブジェクト型メンバーを含む union に対するエラーが正しく報告されることを検証する
  - 型参照解決エラーが正しく報告されることを検証する
  - 診断情報にファイルパス・行番号が含まれることを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

## Task 7. 統合と最終検証
- [x] 7.1 パイプライン全体の統合テストを実施する
  - type-extractor から schema-generator までの一連のフローが正しく動作することを確認する
  - 既存の型生成処理（通常の Input Object、Union 型）への影響がないことを確認する
  - 生成されたスキーマが graphql-js で正しくパースできることを検証する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_
