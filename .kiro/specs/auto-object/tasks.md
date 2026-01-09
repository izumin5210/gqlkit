# Implementation Plan

## Task 1: TSTypeReference データモデル拡張
- [x] 1.1 インラインオブジェクト型を表現するための型システム拡張
  - TSTypeReference に "inlineObject" kind を追加し、インライン定義されたオブジェクト型を識別可能にする
  - インラインオブジェクトのプロパティ情報を保持する InlineObjectPropertyDef 型を定義する
  - プロパティ情報には名前、型参照、オプショナル性、説明、非推奨情報、ディレクティブ、デフォルト値を含める
  - ネストしたインラインオブジェクトを再帰的に表現できる構造にする
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

## Task 2: Type Extractor でのインラインオブジェクト検出
- [x] 2.1 (P) Object type フィールドのインラインオブジェクト検出機能
  - Object type のフィールド型として定義されたインラインオブジェクトリテラルを検出する
  - 検出したインラインオブジェクトの各プロパティから型情報を抽出する
  - TSDoc コメントから description を抽出し、GraphQL の説明として利用可能にする
  - @deprecated タグを検出し、非推奨情報を抽出する
  - _Requirements: 1.1, 5.1_

- [x] 2.2 (P) Input type フィールドのインラインオブジェクト検出機能
  - Input type（*Input suffix を持つ型）のフィールドに定義されたインラインオブジェクトを検出する
  - GqlFieldDef による defaultValue 指定を検出し、デフォルト値情報を抽出する
  - ディレクティブ情報を検出し抽出する
  - _Requirements: 2.1, 5.2_

- [x] 2.3 ネストしたインラインオブジェクトの再帰的検出
  - インラインオブジェクト内のプロパティがさらにインラインオブジェクトを持つ場合、再帰的に検出を行う
  - 任意の深さのネストに対応する
  - nullability および list type の推論を既存ルール通りに適用する
  - Task 2.1 および 2.2 の完了後に実装する
  - _Requirements: 1.2, 2.2, 5.3_

## Task 3: Resolver Extractor でのインラインオブジェクト検出
- [x] 3.1 (P) Query/Mutation resolver 引数のインラインオブジェクト検出
  - defineQuery, defineMutation の型引数で定義された引数型からインラインオブジェクトを検出する
  - 引数名とフィールド名のコンテキスト情報を収集し、型名生成に必要な情報を保持する
  - TSDoc コメントと GqlFieldDef defaultValue を検出する
  - _Requirements: 3.1, 5.1, 5.2_

- [x] 3.2 (P) Field resolver 引数のインラインオブジェクト検出
  - defineField の型引数で定義された引数型からインラインオブジェクトを検出する
  - 親型名、フィールド名、引数名のコンテキスト情報を収集する
  - _Requirements: 3.2_

- [x] 3.3 Resolver 引数のネストしたインラインオブジェクト検出
  - 引数のインラインオブジェクト内でさらにネストしたインラインオブジェクトを再帰的に検出する
  - 既存の nullability/list type 推論ロジックを適用する
  - Task 3.1 および 3.2 の完了後に実装する
  - _Requirements: 3.3, 5.3_

## Task 4: 自動型生成機能の実装
- [x] 4.1 命名規則に基づく型名生成ロジック
  - Object type フィールド用の命名規則を実装: {ParentTypeName}{PascalCaseFieldName}
  - Input type フィールド用の命名規則を実装: {ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input
  - Query/Mutation 引数用の命名規則を実装: {PascalCaseFieldName}{PascalCaseArgName}Input
  - Field resolver 引数用の命名規則を実装: {ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input
  - ネストした型のパス情報を利用して一意な名前を生成する
  - _Requirements: 1.1, 2.1, 3.1, 3.2_

- [x] 4.2 検出されたインラインオブジェクトから GraphQL 型定義の生成
  - Object type フィールドのインラインオブジェクトから GraphQL Object type を生成する
  - Input type フィールドのインラインオブジェクトから GraphQL Input Object type を生成する
  - Resolver 引数のインラインオブジェクトから GraphQL Input Object type を生成する
  - ネストしたインラインオブジェクトを再帰的に型として生成する
  - 生成された型の情報（生成元、パス、コンテキスト）を追跡可能にする
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 5.4_

## Task 5: 名前衝突検出と診断機能
- [x] 5.1 ユーザー定義型との衝突検出
  - 自動生成された型名がユーザー定義型と衝突するケースを検出する
  - 衝突した型名、衝突元のソース位置（ファイル名・行番号）を含む診断情報を生成する
  - 推奨される解決方法（フィールド名の変更や明示的な型定義の使用）を診断メッセージに含める
  - _Requirements: 1.3, 2.3, 3.4, 4.1_

- [x] 5.2 自動生成型同士の衝突検出
  - 複数の自動生成型名が互いに衝突するケースを検出する
  - すべての衝突箇所のソース位置を列挙した診断情報を生成する
  - 衝突を解決するための推奨アクションをメッセージに含める
  - _Requirements: 4.2_

- [x] 5.3 衝突検出時のスキーマ生成中断処理
  - 名前衝突が検出された場合、スキーマ生成を中断する
  - ゼロ以外の終了コードを返却する
  - 診断情報を標準エラー出力に表示する
  - _Requirements: 4.3_

## Task 6: パイプライン統合
- [x] 6.1 自動型生成のパイプラインへの組み込み
  - graphql-converter 処理前に自動型生成を実行するよう統合する
  - 生成された型を ExtractTypesResult に追加する
  - フィールドの型参照を生成された型名に更新する
  - _Requirements: 5.4_

- [x] 6.2 名前衝突検証のパイプラインへの組み込み
  - 自動型生成後、result-integrator 前に衝突検証を実行する
  - 衝突検出時は後続処理をスキップし診断情報を返す
  - 衝突がない場合は通常の統合処理を継続する
  - _Requirements: 4.3, 5.4_

## Task 7: Golden File テスト追加
- [x] 7.1 (P) 基本的なインラインオブジェクトのテスト
  - Object type フィールドの基本的なインラインオブジェクト生成をテストする
  - 生成される Object type の名前と構造を検証する
  - _Requirements: 1.1_

- [x] 7.2 (P) ネストしたインラインオブジェクトのテスト
  - 複数階層にネストしたインラインオブジェクトの生成をテストする
  - 再帰的な命名規則の適用を検証する
  - _Requirements: 1.2, 2.2, 3.3_

- [x] 7.3 (P) Input type インラインオブジェクトのテスト
  - Input type フィールドのインラインオブジェクトから Input Object type が生成されることをテストする
  - Input suffix の除去と付与の命名規則を検証する
  - _Requirements: 2.1_

- [x] 7.4 (P) Resolver 引数インラインオブジェクトのテスト
  - Query/Mutation resolver 引数のインラインオブジェクト生成をテストする
  - Field resolver 引数のインラインオブジェクト生成をテストする
  - 各コンテキストでの命名規則を検証する
  - _Requirements: 3.1, 3.2_

- [x] 7.5 (P) 名前衝突エラーのテスト
  - ユーザー定義型との衝突時のエラー出力をテストする
  - 自動生成型同士の衝突時のエラー出力をテストする
  - 衝突時のスキーマ生成中断を検証する
  - _Requirements: 1.3, 2.3, 3.4, 4.1, 4.2, 4.3_

- [x] 7.6 (P) 既存機能との互換性テスト
  - TSDoc description 付きインラインオブジェクトの description 抽出をテストする
  - GqlFieldDef defaultValue 付きインラインオブジェクトのデフォルト値生成をテストする
  - nullability と list type の推論が正しく動作することを検証する
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
