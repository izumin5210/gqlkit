# Implementation Plan

## Task Format Template

- [ ] {NUMBER}. {TASK_DESCRIPTION}
- [ ] {NUMBER}.{SUB_NUMBER} {SUB_TASK_DESCRIPTION}
  - Detail items
  - _Requirements: X.X, Y.Y_

---

- [x] 1. ResultIntegrator の修正
- [x] 1.1 Define API リゾルバの resolverExportName 設定
  - Define API から抽出されたリゾルバの情報を ExtensionField に変換する際、エクスポートされた変数名を resolverExportName として設定する
  - Query/Mutation リゾルバは対応するルート型の ExtensionField として構造化し、resolverExportName を保持する
  - フィールドリゾルバは親型名を使用して適切な TypeExtension にマッピングし、resolverExportName を設定する
  - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 3.4_
  - _Contracts: ResultIntegrator Service Interface_

- [x] 1.2 ResultIntegrator の単体テスト
  - Query リゾルバが resolvers.Query として resolverExportName 付きで構造化されることを検証する
  - Mutation リゾルバが resolvers.Mutation として resolverExportName 付きで構造化されることを検証する
  - フィールドリゾルバが親型に基づいて正しく分類され、resolverExportName が設定されることを検証する
  - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 3.4_

- [x] 2. ResolverCollector の実装
- [x] 2.1 resolver map 用情報の収集ロジック
  - IntegratedResult の typeExtensions を走査し、resolverExportName を持つフィールドを FieldResolver として収集する
  - 直接エクスポート（Define API）の場合は isDirectExport を true に設定する
  - ソースファイルパスを FieldResolver に保持し、import 文生成で使用できるようにする
  - _Requirements: 1.1, 2.1, 3.1_
  - _Contracts: ResolverCollector Service Interface_

- [x] 2.2 決定論的なソート順序の実装
  - 型名をアルファベット順にソートする（Query, Mutation も含む全型）
  - 各型内のフィールド名をアルファベット順にソートする
  - ソースファイルリストもアルファベット順にソートする
  - _Requirements: 6.2, 6.3_

- [x] 2.3 ResolverCollector の単体テスト
  - 複数の型とフィールドを持つ IntegratedResult から正しく FieldResolver が収集されることを検証する
  - 出力が常にソート済みであることを検証する
  - 直接エクスポート判定が正しく動作することを検証する
  - _Requirements: 1.1, 2.1, 3.1, 6.2, 6.3_

- [x] 3. CodeEmitter の実装
- [x] 3.1 import 文の生成
  - 出力ディレクトリからソースファイルへの相対パスを計算する
  - パスが ./ で始まらない場合は先頭に ./ を追加する
  - .ts 拡張子を .js に変換して ESM 互換性を確保する
  - 同一ファイルから複数のリゾルバをインポートする場合は単一の import 文にまとめる
  - import 文をパスのアルファベット順にソートする
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.4_
  - _Contracts: CodeEmitter Service Interface_

- [x] 3.2 resolver map の生成
  - 直接エクスポートの場合は `fieldName: resolverValueName` 形式で出力する
  - 型ごとにオブジェクトを生成し、resolver map として構造化する
  - 生成されるコードが makeExecutableSchema の resolvers パラメータとして直接使用できることを保証する
  - _Requirements: 5.1, 5.2_

- [x] 3.3 出力の決定論性確保
  - 同じ入力に対して常に同一の resolvers.ts を生成する
  - 型名、フィールド名、import パスのソート順序を一貫させる
  - _Requirements: 6.1_

- [x] 3.4 CodeEmitter の単体テスト
  - import パス計算が正しく動作することを検証する（相対パス、.js 変換、./ 追加）
  - 同一ファイルからの複数インポートが正しくまとめられることを検証する
  - 生成される resolver map が期待するフォーマットであることを検証する
  - 同じ入力で複数回実行しても出力が同一であることを検証する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 6.1, 6.4_

- [x] 4. パイプライン統合とエンドツーエンドテスト
- [x] 4.1 抽出から生成までの統合テスト
  - DefineApiExtractor から CodeEmitter までのパイプライン全体を通した処理を検証する
  - 複数ファイルからのリゾルバ収集が正しく動作することを検証する
  - Query、Mutation、フィールドリゾルバの組み合わせが正しく処理されることを検証する
  - _Requirements: 5.3_

- [x] 4.2 makeExecutableSchema 互換性の検証
  - 生成された resolver map が graphql-tools の makeExecutableSchema で使用できることを検証する
  - 生成されたスキーマで GraphQL クエリを実行し、リゾルバが正しく呼び出されることを検証する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. サンプルプロジェクトでの動作確認
- [x] 5.1 (P) define-api サンプルの検証
  - gqlkit gen を実行し、Query、Mutation、フィールドリゾルバを含む resolver map が生成されることを確認する
  - 生成されたスキーマでクエリを実行し、期待通りの結果が返ることを確認する
  - _Requirements: 7.1, 7.6_

- [x] 5.2 (P) basic-types サンプルの検証
  - gqlkit gen を実行し、Query リゾルバを含む resolver map が生成されることを確認する
  - 生成されたスキーマでクエリを実行し、期待通りの結果が返ることを確認する
  - _Requirements: 7.2, 7.6_

- [x] 5.3 (P) mutations サンプルの検証
  - gqlkit gen を実行し、Mutation リゾルバを含む resolver map が生成されることを確認する
  - 生成されたスキーマでミューテーションを実行し、期待通りの結果が返ることを確認する
  - _Requirements: 7.3, 7.6_

- [x] 5.4 (P) type-relations サンプルの検証
  - gqlkit gen を実行し、フィールドリゾルバを含む resolver map が生成されることを確認する
  - 生成されたスキーマでクエリを実行し、期待通りの結果が返ることを確認する
  - _Requirements: 7.4, 7.6_

- [x] 5.5 (P) type-extensions サンプルの検証
  - gqlkit gen を実行し、型拡張フィールドリゾルバを含む resolver map が生成されることを確認する
  - 生成されたスキーマでクエリを実行し、期待通りの結果が返ることを確認する
  - _Requirements: 7.5, 7.6_
