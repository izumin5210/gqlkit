# Implementation Plan

## Task Format Template

- [ ] {{NUMBER}}. {{TASK_DESCRIPTION}}{{PARALLEL_MARK}}
  - {{DETAIL_ITEM}}
  - _Requirements: {{REQUIREMENT_IDS}}_

---

- [x] 1. Runtime Layer と CLI/Shared Layer の基盤実装
- [x] 1.1 (P) Branded Scalar 型定義の実装（Runtime Layer）
  - GraphQL ID scalar に対応する文字列ベースの branded type を定義する
  - GraphQL ID scalar に対応する数値ベースの branded type を定義する
  - GraphQL Int scalar に対応する branded type を定義する
  - GraphQL Float scalar に対応する branded type を定義する
  - unique symbol パターンを使用して各型を区別可能にする
  - 既存の ResolverBrandSymbol と同様のパターンで実装する
  - 型レベルでのみ存在し、ランタイムコストがないことを確認するテストを作成する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.2 (P) Scalar マッピングレジストリの実装（CLI/Shared Layer）
  - packages/cli/src/shared/scalar-registry.ts に実装する
  - Branded type 名から GraphQL scalar 型へのマッピング情報を管理するデータ構造を作成する
  - 標準の 4 つの branded type（IDString, IDNumber, Int, Float）のマッピングをデフォルト値として定義する
  - マッピング情報には GraphQL scalar 名、brand 名、base type（string/number）を含める
  - 将来のカスタム scalar 拡張に備えた設計とする
  - マッピング情報が不変であることを保証する
  - _Requirements: 5.1, 5.2_

- [x] 2. シンボル解決機能の実装
  - TypeScript 型シンボルのインポート元モジュールを特定する機能を実装する
  - @gqlkit-ts/runtime パッケージからのインポートかどうかを判定するロジックを作成する
  - ts.Symbol.declarations からインポート宣言を辿る処理を実装する
  - シンボルが存在しない場合は undefined を返す
  - パスエイリアスやモジュール再エクスポートのケースを考慮する
  - シンボル解決のユニットテストを作成する
  - _Requirements: 2.1_

- [x] 3. Branded Type 検出機能の実装
- [x] 3.1 Branded Type 検出ロジックの実装
  - TypeScript 型から branded scalar type を検出する機能を実装する
  - シンボル解決を使用して @gqlkit-ts/runtime からのインポートを確認する
  - 検出された branded type を ScalarTypeInfo として返す
  - IDString を ID scalar（文字列ベース）としてマークする
  - IDNumber を ID scalar（数値ベース）としてマークする
  - Int 型を Int scalar としてマークする
  - Float 型を Float scalar としてマークする
  - 通常の number 型は Float としてマッピングする（整数が必要な場合は Int branded type を使用）
  - 同一入力に対して同一結果を返すことを保証する
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3.2 未知の Branded Type 処理の実装
  - 未知の branded type が検出された場合に警告診断を生成する
  - 未知の branded type は String 型としてフォールバックする
  - 拡張ポイントを設けて将来のカスタム scalar 追加に備える
  - 警告メッセージには型名とインポート元を含める
  - _Requirements: 5.3, 5.4_

- [x] 4. 型システムへの統合
- [x] 4.1 (P) Type-extractor Converter の拡張
  - 既存の型変換ロジックに branded type チェックを追加する
  - reference 型かつ @gqlkit-ts/runtime からの branded type の場合、BrandedDetector を使用する
  - 検出された scalar type を GraphQL フィールド型の typeName に設定する
  - nullable 属性を正しく保持する
  - リスト型属性を正しく保持する
  - 複合型（配列かつ nullable など）での動作を確認するテストを作成する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.2 (P) Resolver-extractor の引数型サポート拡張
  - リゾルバ引数型内の branded type を認識する機能を追加する
  - Input Object 型のフィールドで branded type が使用された場合に対応する GraphQL scalar を出力する
  - Query/Mutation の直接引数で branded type が使用された場合に対応する GraphQL scalar を出力する
  - TSTypeReference に scalar 情報を保持するための拡張を行う
  - 引数型での branded type 使用のテストを作成する
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. エラーハンドリングと診断機能
  - Branded type のインポートが不正な場合のエラーメッセージを実装する
  - Branded type と他の型が矛盾する形で使用された場合のエラーメッセージを実装する
  - エラーメッセージにインポート元と具体的なエラー内容を含める
  - CLI 出力時にファイル名と行番号を含めた診断情報を報告する
  - 既存の Diagnostic インターフェースを使用して診断情報を統合する
  - エラー・警告診断のテストを作成する
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. 統合テストと E2E テスト
- [x] 6.1 統合テストの作成
  - 型定義から GraphQL スキーマ生成までの完全なパイプラインテストを作成する
  - リゾルバ引数での branded type 使用時のスキーマ生成テストを作成する
  - Input Object 型での branded type 使用時のスキーマ生成テストを作成する
  - 複合型（配列、nullable）での branded type テストを作成する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

- [x] 6.2 E2E テストの作成
  - 実際のユーザコードパターンでのスキーマ生成テストを作成する
  - number から Float へのマッピングが正しく動作することを確認するテストを作成する
  - エラーメッセージにファイル名・行番号が含まれることを確認するテストを作成する
  - _Requirements: 2.6, 6.3_
