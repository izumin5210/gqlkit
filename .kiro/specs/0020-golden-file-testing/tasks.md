# Implementation Plan

- [x] 1. coreGenerate 関数の抽出
  - 既存の orchestrator.ts からファイル I/O を除いたコア生成パイプラインを純粋関数として抽出
  - 入力として ts.Program、設定、ファイルパス情報を受け取り、スキーマ AST コード、SDL、リゾルバコード、診断情報を返す
  - 既存の executeGeneration を coreGenerate を呼び出すようリファクタリング
  - 同一入力に対して常に同一出力を返す決定論的な動作を保証
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. テストインフラストラクチャの構築
- [x] 2.1 (P) TestCaseLoader の実装
  - testdata ディレクトリからテストケースを自動検出する機能を実装
  - types/, resolvers/ ディレクトリから入力ファイルを読み込み
  - expected/ ディレクトリから期待出力（schema.ts, schema.graphql, resolvers.ts）を読み込み
  - config.json（設定）と diagnostics.json（診断期待）のオプショナルファイルをサポート
  - テストケースごとに ts.Program を作成（テストケースファイルをルートファイルとして使用）
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.2 (P) OutputComparator の実装
  - 生成出力と期待出力の文字列ベース厳密比較を実装
  - 不一致時に unified diff 形式で差分を表示
  - 診断メッセージのスナップショット比較をサポート
  - _Requirements: 2.3, 2.4_

- [x] 2.3 GoldenTestRunner の統合
  - Vitest の describe.each を使用してすべてのテストケースをパラメタライズドテストとして実行
  - TestCaseLoader、coreGenerate、OutputComparator を組み合わせたテスト実行フロー
  - テスト失敗時に明確な差分を表示
  - _Requirements: 2.5_

- [x] 3. Golden ファイル更新機能の実装
  - 環境変数 UPDATE_GOLDEN=true による更新モードの検出
  - 更新モード時に生成結果で期待出力ファイルを上書き
  - 更新されたファイルをコンソールにレポート
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. 基本型テストケースの作成
- [x] 4.1 (P) オブジェクト型テストケース
  - 基本的なオブジェクト型の生成を検証するテストケースを作成
  - types/, resolvers/, expected/ ディレクトリ構造を用意
  - _Requirements: 5.1_

- [x] 4.2 (P) Union 型テストケース
  - Union 型の生成を検証するテストケースを作成
  - _Requirements: 5.2_

- [x] 4.3 (P) Input Object 型テストケース
  - Input Object 型の生成を検証するテストケースを作成
  - _Requirements: 5.3_

- [x] 4.4 (P) ブランド型スカラーテストケース
  - testdata/_runtime_types/@gqlkit-ts/runtime にモック型定義を配置
  - testdata/tsconfig.json で paths 設定によりモジュール解決
  - IDString → ID, Int → Int の変換を検証
  - _Requirements: 5.4_

- [x] 5. リゾルバテストケースの作成
- [x] 5.1 (P) Query リゾルバテストケース
  - Query リゾルバの生成を検証するテストケースを作成
  - _Requirements: 5.5_

- [x] 5.2 (P) Mutation リゾルバテストケース
  - Mutation リゾルバの生成を検証するテストケースを作成
  - _Requirements: 5.6_

- [x] 5.3 (P) Field リゾルバテストケース
  - Field リゾルバの生成を検証するテストケースを作成
  - _Requirements: 5.7_

- [x] 6. メタデータとカスタム設定テストケースの作成
- [x] 6.1 (P) TSDoc description テストケース
  - TSDoc からの description 生成を検証するテストケースを作成
  - _Requirements: 5.8_

- [x] 6.2 (P) @deprecated ディレクティブテストケース
  - @deprecated ディレクティブの生成を検証するテストケースを作成
  - _Requirements: 5.9_

- [x] 6.3 (P) カスタムスカラー設定テストケース
  - カスタムスカラー設定の適用を検証するテストケースを作成
  - config.json にカスタムスカラー設定を含める
  - _Requirements: 5.10_

- [x] 7. 診断テストケースの作成
- [x] 7.1 (P) 型エラー診断テストケース
  - 型定義のエラー診断を検証するテストケースを作成
  - expected/diagnostics.json で期待される診断を定義
  - _Requirements: 5.11_

- [x] 7.2 (P) リゾルバエラー診断テストケース
  - 削除: 現在のリゾルバ抽出ロジックでは、未定義型に対するエラー診断を生成しない
  - 型の未定義エラーは型エラー診断テストケースでカバーされている
  - _Requirements: 5.12_
