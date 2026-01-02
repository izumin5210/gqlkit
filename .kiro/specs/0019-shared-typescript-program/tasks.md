# Implementation Plan

## Task 1: TsconfigLoader の実装
- [x] 1.1 (P) tsconfig.json の検索機能を実装する
  - カレントディレクトリから tsconfig.json を自動検索するロジックを構築する
  - TypeScript Compiler API の findConfigFile を活用して検索を行う
  - tsconfig.json が見つからない場合は null を返す
  - 単体テストで検索ロジックの正常系・異常系を検証する
  - _Requirements: 2.1_

- [x] 1.2 tsconfig.json の読み込みと解析機能を実装する
  - TypeScript Compiler API を使用して tsconfig.json を読み込む
  - parseJsonConfigFileContent で compilerOptions を解析する
  - extends フィールドが存在する場合は継承元の設定を自動解決する
  - JSON パースエラー時に適切なエラーメッセージを生成する
  - 単体テストで読み込み・解析・継承解決を検証する
  - _Requirements: 2.2, 2.3_

- [x] 1.3 カスタム tsconfig パスの処理を実装する
  - 相対パスと絶対パスの両方を受け付ける
  - 指定されたパスが存在しない場合は診断エラーを生成する
  - パスの正規化処理を行う
  - 単体テストで相対パス・絶対パス・不正パスのケースを検証する
  - _Requirements: 3.2, 3.3_

## Task 2: ProgramFactory の実装
- [x] 2.1 共有 Program インスタンスの生成機能を実装する
  - TsconfigLoader から取得した compilerOptions を使用して Program を生成する
  - tsconfig.json が存在しない場合はデフォルトの compilerOptions を適用する
  - typeFiles と resolverFiles を統合して単一の Program を生成する
  - 生成時のエラーを diagnostics として収集する
  - 単体テストで Program 生成の正常系・デフォルト動作を検証する
  - _Requirements: 1.1, 1.2, 2.4, 4.3_

## Task 3: GqlkitConfig への tsconfigPath オプション追加
- [x] 3.1 (P) 設定ファイルに tsconfigPath オプションを追加する
  - GqlkitConfig 型定義に tsconfigPath プロパティを追加する
  - ResolvedConfig に tsconfigPath の解決結果を含める
  - config-loader で tsconfigPath の読み込み処理を追加する
  - デフォルト値として null を設定する
  - 単体テストで設定読み込みを検証する
  - _Requirements: 3.1_

## Task 4: extractTypes の修正
- [x] 4.1 TypeExtractor が外部から Program を受け取れるように修正する
  - ExtractTypesOptions に program パラメータを追加する
  - program が渡された場合は内部での createProgramFromFiles をスキップする
  - program が null の場合は従来通り内部で生成して後方互換性を維持する
  - 既存の単体テストが引き続きパスすることを確認する
  - 新しいテストで外部 Program 使用時の動作を検証する
  - _Requirements: 1.3, 4.2_

## Task 5: extractResolvers の修正
- [x] 5.1 (P) ResolverExtractor が外部から Program を受け取れるように修正する
  - ExtractResolversOptions に program パラメータを追加する
  - program が渡された場合は内部での createProgramFromFiles をスキップする
  - program が null の場合は従来通り内部で生成して後方互換性を維持する
  - 既存の単体テストが引き続きパスすることを確認する
  - 新しいテストで外部 Program 使用時の動作を検証する
  - _Requirements: 1.4, 4.2_

## Task 6: Orchestrator の統合
- [x] 6.1 executeGeneration で共有 Program を生成して extractors に注入する
  - ファイルスキャンを先に実行し、対象ファイル一覧を取得する
  - ProgramFactory を使用して共有 Program を生成する
  - 生成した Program を extractTypes と extractResolvers に渡す
  - GenerationConfig に tsconfigPath を追加し、設定から読み込む
  - Program 生成失敗時は早期リターンしてエラーを報告する
  - 統合テストで共有 Program を使用した抽出処理を検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_

## Task 7: E2E テスト
- [x] 7.1 tsconfig.json を使用したプロジェクトでの E2E テストを追加する
  - tsconfig.json が存在するプロジェクトで gen コマンドを実行して正常動作を確認する
  - paths エイリアスを使用したプロジェクトで型解析が正しく動作することを検証する
  - 設定ファイルで tsconfigPath を指定した場合の動作を検証する
  - _Requirements: 2.1, 2.2, 3.1_

- [x] 7.2 後方互換性の E2E テストを追加する
  - tsconfig.json が存在しないプロジェクトで gen コマンドを実行して従来と同等の出力を確認する
  - tsconfigPath オプションを指定しない場合の動作を検証する
  - 既存の E2E テストケースがすべてパスすることを確認する
  - _Requirements: 4.1, 4.2, 4.3_
