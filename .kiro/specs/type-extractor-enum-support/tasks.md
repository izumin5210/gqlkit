# Implementation Plan

## Task 1. 型定義の拡張
- [x] 1.1 TypeScript 抽出層の型定義を拡張する
  - TypeKind に "enum" を追加し、enum 種別を識別できるようにする
  - enum メンバー情報を保持する EnumMemberInfo 型を定義する（名前と値のペア）
  - ExtractedTypeInfo に enumMembers フィールドを追加し、抽出された enum メンバーを格納できるようにする
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2_

- [x] 1.2 (P) GraphQL 変換層の型定義を拡張する
  - GraphQLTypeKind に "Enum" を追加し、GraphQL enum 型を識別できるようにする
  - GraphQL enum 値情報を保持する EnumValueInfo 型を定義する（変換後の名前と元の値）
  - GraphQLTypeInfo に enumValues フィールドを追加し、変換後の enum 値を格納できるようにする
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 1.3 (P) 診断コードを拡張する
  - DiagnosticCode に UNSUPPORTED_ENUM_TYPE を追加する（numeric/heterogeneous/const enum 検出用）
  - DiagnosticCode に INVALID_ENUM_MEMBER を追加する（無効な GraphQL 識別子検出用）
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

## Task 2. TypeScript enum の検出・抽出機能
- [x] 2.1 enum 種別の判定機能を実装する
  - string enum かどうかを判定する機能を実装する（全メンバーが文字列値を持つ）
  - numeric enum かどうかを判定する機能を実装する（全メンバーが数値のみ）
  - heterogeneous enum かどうかを判定する機能を実装する（文字列と数値が混在）
  - const enum かどうかを判定する機能を実装する（const 修飾子の存在確認）
  - _Requirements: 1.4, 4.1, 4.2, 4.4_

- [x] 2.2 TypeScript enum からメンバー情報を抽出する
  - EnumDeclaration ノードから全メンバーの名前と値を抽出する
  - 各メンバーの定義順序を維持して抽出する
  - named export と default export の両方に対応する
  - 非対応の enum（numeric/heterogeneous/const）検出時は診断メッセージを出力し、対応方法を提案する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.4_

## Task 3. String literal union の検出・抽出機能
- [x] 3.1 (P) string literal union の判定機能を実装する
  - type alias が string literal のみの union かどうかを判定する機能を実装する
  - null/undefined を含む nullable union を識別し、それらを除外して判定する
  - string literal と他の型（number, object 等）が混在する union は enum として扱わず通常処理する
  - _Requirements: 2.1, 2.3, 4.3_

- [x] 3.2 string literal union からメンバー情報を抽出する
  - 前提: 3.1 の判定機能が完了していること
  - union の各 string literal を enum メンバーとして抽出する
  - null/undefined は除外し、string literal のみを抽出する
  - リテラルの定義順序を維持して抽出する
  - _Requirements: 2.2, 2.3, 2.4_

## Task 4. GraphQL enum への変換機能
- [x] 4.1 enum メンバー名の変換機能を実装する
  - 任意の文字列を SCREAMING_SNAKE_CASE に変換する機能を実装する
  - 小文字を大文字に変換し、単語境界にアンダースコアを挿入する
  - ハイフンやスペースはアンダースコアに置換する
  - _Requirements: 3.3, 3.4_

- [x] 4.2 (P) GraphQL 識別子のバリデーション機能を実装する
  - 変換後の名前が GraphQL 識別子として有効かチェックする機能を実装する
  - 無効な文字（GraphQL 識別子規則に違反）を検出した場合は INVALID_ENUM_MEMBER 診断を出力する
  - _Requirements: 4.5_

- [x] 4.3 抽出された enum を GraphQL 型に変換する
  - 前提: 4.1, 4.2 の機能が完了していること
  - ExtractedTypeInfo (kind=enum) を GraphQLTypeInfo (kind=Enum) に変換する
  - 各 enum メンバーを SCREAMING_SNAKE_CASE に変換し、元の値を保持する
  - RESERVED_TYPE_NAMES チェックを enum 型名にも適用する
  - _Requirements: 3.1, 3.2, 3.5, 5.4_

## Task 5. AST Builder の拡張
- [x] 5. GraphQL enum の AST ノード構築機能を実装する
  - EnumValueDefinitionNode を構築する機能を実装する
  - EnumTypeDefinitionNode を構築する機能を実装する
  - 既存の buildDocumentNode に kind=Enum の分岐を追加する
  - enum 値の定義順序を維持して AST を構築する
  - _Requirements: 3.1, 3.2_

## Task 6. 統合とテスト
- [x] 6.1 TypeExtractor に enum 抽出を統合する
  - 前提: Task 2, 3 が完了していること
  - 既存のファイルスキャン処理に EnumDeclaration の検出を追加する
  - 既存の type alias 処理に string literal union の判定を追加する
  - 同一ファイル内の enum と Object 型が両方正しく抽出されることを確認する
  - 既存の Object/Union 型の抽出動作が影響を受けないことを確認する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6.2 GraphQLConverter に enum 変換を統合する
  - 前提: Task 4 が完了していること
  - 既存の変換処理に kind=enum の分岐を追加する
  - 既存の Object/Union 変換が影響を受けないことを確認する
  - _Requirements: 5.1, 5.2_

- [x] 6.3 エンドツーエンドの統合テストを実装する
  - 前提: 6.1, 6.2 が完了していること
  - TypeScript enum から GraphQL enum への完全な変換フローをテストする
  - string literal union から GraphQL enum への完全な変換フローをテストする
  - 非対応パターンでの診断メッセージ出力をテストする
  - 既存の Object/Union 型のみを含むソースの動作確認をテストする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4_
