# Implementation Plan

## Task 1. Core型定義の実装

- [x] 1.1 (P) 診断情報の型定義
  - エラーと警告を区別するseverityフィールドを持つDiagnostic型を定義
  - ソース位置情報（ファイル、行、列）を表すSourceLocation型を定義
  - 診断コード（DIRECTORY_NOT_FOUND、PARSE_ERROR、UNSUPPORTED_SYNTAX、RESERVED_TYPE_NAME、UNRESOLVED_REFERENCE）を定義
  - errorsとwarningsを分離して保持するDiagnostics型を定義
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 1.2 (P) GraphQL型情報のインターフェース定義
  - GraphQL型種別（Object、Union）を表す型を定義
  - 型名、種別、フィールド一覧、unionメンバー、ソースファイルを持つGraphQLTypeInfo型を定義
  - フィールド名と型情報を持つFieldInfo型を定義
  - nullable、list、listItemNullableの修飾子を持つGraphQLFieldType型を定義
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 1.3 (P) TypeScript型メタデータのインターフェース定義
  - 型種別（object、interface、union）を表すTypeKind型を定義
  - 名前、種別、ソースファイル、exportの種類を持つTypeMetadata型を定義
  - TypeScript型参照を表すTSTypeReference型を定義（primitive、reference、array、union、literal）
  - フィールド定義とextractした型情報を表す型を定義
  - _Requirements: 1.4, 4.4_

## Task 2. FileScanner - ディレクトリスキャン機能

- [x] 2.1 (P) ディレクトリの再帰的スキャン実装
  - 指定ディレクトリ配下の全TypeScriptファイルを再帰的に列挙する機能を実装
  - .tsファイルを対象とし、.d.tsファイルは除外する
  - node_modulesディレクトリを除外する
  - ファイルパスを絶対パスで返却する
  - _Requirements: 1.1_

- [x] 2.2 (P) スキャン結果のソートとエラーハンドリング
  - ファイルパスをアルファベット順にソートして決定論的な順序を保証
  - ディレクトリが存在しない場合にDIRECTORY_NOT_FOUNDエラーを生成
  - エラー時もスキャン結果（空のfiles配列とエラー情報）を返却する構造を採用
  - _Requirements: 5.1, 6.2_

## Task 3. TypeExtractor - TypeScript型の抽出

- [x] 3.1 TypeScript Programの作成
  - スキャンしたファイルパス一覧からts.createProgramでProgramインスタンスを作成
  - 適切なCompilerOptionsを設定（strict mode、ESM対応）
  - TypeCheckerを取得してAST解析の準備を行う
  - _Requirements: 1.2_

- [x] 3.2 Export型定義の検出ロジック
  - ts.forEachChildでソースファイルのトップレベル宣言を走査
  - ts.getCombinedModifierFlagsでexportフラグを確認
  - type aliasとinterfaceの宣言を検出
  - exportされていない型定義を除外する
  - named exportとdefault exportを区別して記録
  - _Requirements: 1.2, 1.3_

- [x] 3.3 型メタデータの収集
  - 検出した型の名前を取得
  - 型種別（type alias/interface）を判定
  - ソースファイルパスを記録
  - object type、interface、union typeを区別する
  - _Requirements: 1.4_

- [x] 3.4 フィールド情報の抽出
  - object typeとinterfaceのメンバーを列挙
  - 各フィールドの名前を取得
  - 各フィールドのTypeScript型情報を解析してTSTypeReferenceとして記録
  - optionalフィールドの検出
  - union typeのメンバー型を列挙
  - _Requirements: 1.4, 3.3, 3.4_

- [x] 3.5 パースエラーと未サポート構文の診断
  - TypeScriptファイルのパースエラーを検出してPARSE_ERRORとして報告
  - ソース位置情報（ファイル、行、列）を診断に含める
  - 未サポートのTypeScript構文（ジェネリクス、条件型など）をUNSUPPORTED_SYNTAXとして警告
  - 最初のエラーで中断せず、全ファイルを処理して診断を収集
  - _Requirements: 5.2, 5.3, 5.4_

## Task 4. GraphQLConverter - GraphQL型への変換

- [x] 4.1 (P) プリミティブ型のマッピング
  - stringをGraphQL Stringに変換
  - numberをGraphQL Intに変換
  - booleanをGraphQL Booleanに変換
  - プリミティブ型以外は型参照として記録
  - _Requirements: 2.5_

- [x] 4.2 Object型とInterface型の変換
  - TypeScript object typeをGraphQL Object型に変換
  - TypeScript interfaceをGraphQL Object型に変換
  - フィールド一覧をFieldInfo配列として構築
  - 各フィールドの型情報をGraphQLFieldTypeに変換
  - _Requirements: 2.1_

- [x] 4.3 Union型の変換
  - TypeScript union type（A | B形式）をGraphQL Union型に変換
  - unionメンバーの型名を配列として記録
  - プリミティブ型のunionはサポート対象外としてUNSUPPORTED_SYNTAX警告を生成
  - _Requirements: 2.2_

- [x] 4.4 Nullable型とList型の変換
  - T | nullをnullable型として記録
  - T | undefinedをnullable型として記録
  - optionalフィールドをnullable型として記録
  - T[]とArray<T>をList型として記録
  - Listの要素型のnullabilityを判定してlistItemNullableに記録
  - _Requirements: 2.3, 2.4_

- [x] 4.5 組み込み型名との競合検出
  - GraphQL組み込み型（Query、Mutation、Subscription、Int、Float、String、Boolean、ID）との名前競合を検出
  - 競合時にRESERVED_TYPE_NAMEエラーを生成
  - ソース位置情報を含めて診断を報告
  - _Requirements: 2.6_

## Task 5. TypeValidator - 型参照の検証

- [x] 5.1 型参照の解決可能性検証
  - 抽出した全型名のセットを構築
  - GraphQL組み込みスカラー型（String、Int、Boolean）をセットに追加
  - 各フィールドの型参照が解決可能かをO(1)でルックアップ検証
  - union typeのメンバー型参照も検証対象に含める
  - _Requirements: 3.4, 3.5_

- [x] 5.2 未解決参照のエラー報告
  - 解決できない型参照をUNRESOLVED_REFERENCEエラーとして報告
  - 参照元のフィールド名と参照先の型名をエラーメッセージに含める
  - ソース位置情報を診断に含める
  - 全ての未解決参照を収集して一括報告
  - _Requirements: 3.5, 5.4_

## Task 6. ResultCollector - 結果の集約とソート

- [x] 6.1 (P) 決定論的な出力順序の保証
  - 型情報を型名のアルファベット順でソート
  - 各型のフィールドをフィールド名のアルファベット順でソート
  - union typeのメンバーをアルファベット順でソート
  - 同一入力に対して常に同一の出力順序を保証
  - _Requirements: 6.1, 6.3_

- [x] 6.2 (P) 診断情報の集約
  - 各コンポーネントからの診断情報を集約
  - 重複する診断を排除
  - errorsとwarningsを分離してDiagnostics型として構築
  - _Requirements: 5.4_

## Task 7. extractTypes - エントリポイントの統合

- [x] 7.1 パイプラインの調整と実行
  - extractTypes関数を単一のエクスポートとして公開
  - ディレクトリパスを入力として受け取るExtractTypesOptions型を定義
  - FileScanner → TypeExtractor → GraphQLConverter → TypeValidator → ResultCollectorのパイプラインを調整
  - 非同期でPromise<ExtractTypesResult>を返却
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7.2 結果の型定義と返却
  - ExtractTypesResult型を定義（types配列とdiagnostics）
  - 全コンポーネントからの診断情報を統合
  - エラーがあっても可能な限り型情報を返却（部分的成功）
  - 致命的エラー（ディレクトリ不在）時は空の型配列とエラー診断を返却
  - _Requirements: 3.1, 4.3, 4.4_

## Task 8. 統合テストとE2Eテスト

- [x] 8.1 パイプライン全体の統合テスト
  - 複数ファイルにまたがる型定義の抽出を検証
  - 型参照の解決を検証
  - エラー収集と一括報告の動作を検証
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.4, 3.5, 5.4_

- [x] 8.2 決定論的出力の検証テスト
  - 同一のソースコードに対して複数回実行し、同一出力を確認
  - ファイルスキャン順序を変えても出力が同一であることを確認
  - 型とフィールドのソート順序を検証
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 8.3 型変換の網羅的テスト
  - プリミティブ型（string、number、boolean）の変換を検証
  - Object型とInterface型の変換を検証
  - Union型の変換を検証
  - Nullable型（T | null、T | undefined、optional）の検出を検証
  - List型（T[]、Array<T>）の変換を検証
  - 組み込み型名との競合検出を検証
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
