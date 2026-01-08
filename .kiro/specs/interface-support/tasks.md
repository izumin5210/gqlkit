# Implementation Plan

## Task Overview

GraphQL interface 型サポートの実装タスク。Runtime 型定義から始まり、CLI パイプラインの各ステージを拡張し、最終的にテストケースで検証する。

---

- [x] 1. Runtime 型定義の実装
- [x] 1.1 (P) DefineInterface ユーティリティ型を定義する
  - Interface のフィールド定義を表現する型パラメータを受け取る構造を設計する
  - Interface が他の Interface を継承できるよう、implements メタデータオプションをサポートする
  - `$gqlkitInterfaceMeta` プロパティで CLI が Interface 型を識別できるようにする
  - 実行時オーバーヘッドなし（型レベルのみ）を維持する
  - _Requirements: 1.1, 1.2, 1.3, 7.1_

- [x] 1.2 (P) GqlTypeDef に implements オプションを追加する
  - 既存の Meta 型パラメータを拡張し、implements プロパティを追加する
  - 複数の Interface 型を配列で指定可能にする
  - 既存の directives オプションとの併用をサポートする
  - 後方互換性を維持し、既存コードが壊れないことを確認する
  - _Requirements: 2.1, 2.2, 7.2, 7.3_

- [x] 1.3 Runtime パッケージから新しい型をエクスポートする
  - DefineInterface 型をパッケージのエントリポイントからエクスポートする
  - 必要に応じて型テストを追加し、型推論が正しく動作することを確認する
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Interface 検出機能の実装
- [x] 2.1 Interface 型を検出するロジックを実装する
  - TypeScript 型から `$gqlkitInterfaceMeta` プロパティを検出する
  - DefineInterface が適用されているかどうかを判定する関数を実装する
  - Interface のフィールド定義を抽出する
  - Interface が継承する他の Interface の参照を抽出する
  - _Requirements: 3.1, 3.2_

- [x] 2.2 型定義から implements 宣言を抽出するロジックを実装する
  - GqlTypeDef の Meta から `$gqlkitTypeMeta.implements` を読み取る
  - 参照される Interface 型名を解決する
  - 存在しない Interface への参照を検出し、エラー情報を生成する
  - _Requirements: 3.3, 6.1_

- [x] 3. Interface 検証機能の実装
- [x] 3.1 フィールド互換性を検証するロジックを実装する
  - 実装型が Interface の全フィールドを持つことを検証する
  - 不足フィールドを特定し、詳細なエラー情報を生成する
  - フィールド型の互換性（共変性）を検証する
  - nullability の整合性をチェックする
  - _Requirements: 2.3, 2.4, 2.5, 6.3_

- [x] 3.2 循環的な Interface 参照を検出するロジックを実装する
  - Interface の継承グラフを走査し、循環を検出する
  - 循環経路を含む診断メッセージを生成する
  - _Requirements: 6.4_

- [x] 3.3 検証エラーの診断メッセージを整備する
  - 型名、フィールド名、期待される型情報を含む詳細なメッセージを生成する
  - ソースコード位置情報を付与する
  - 既存の Diagnostic 形式に準拠する
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 4. 型抽出パイプラインの拡張
- [x] 4.1 GraphQL 型の種類に Interface を追加する
  - GraphQLTypeKind 型に "Interface" を追加する
  - GraphQLTypeInfo に implementedInterfaces プロパティを追加する
  - _Requirements: 3.4_

- [x] 4.2 Interface 型定義の抽出処理を実装する
  - 型種別判定ロジックを拡張し、DefineInterface を検出する
  - Interface のフィールドを Object 型と同じロジックで抽出する
  - TSDoc コメントを Interface の description として抽出する
  - _Requirements: 3.1, 3.2, 1.4_

- [x] 4.3 implements 宣言の抽出と内部型グラフへの登録を実装する
  - GqlTypeDef から implements オプションを読み取り、参照を解決する
  - Interface 型と実装型の両方を型グラフに登録する
  - _Requirements: 3.3, 3.4_

- [x] 5. スキーマ生成パイプラインの拡張
- [x] 5.1 統合処理で Interface 型情報を処理する
  - BaseType の kind に "Interface" を追加する
  - Interface 型を baseTypes として統合処理に含める
  - implements 参照の存在チェックと互換性検証を実行する
  - _Requirements: 4.1, 4.2_

- [x] 5.2 Interface 型定義の AST ノードを生成する
  - InterfaceTypeDefinitionNode を構築するロジックを実装する
  - フィールド定義の出力は Object 型と同じ処理を再利用する
  - Interface の継承がある場合は interfaces プロパティを設定する
  - description と directives を適切に出力する
  - _Requirements: 4.1, 4.4_

- [x] 5.3 Object 型定義に implements 句を追加する
  - ObjectTypeDefinitionNode に interfaces プロパティを設定する
  - 複数 Interface の実装を正しくハンドリングする
  - _Requirements: 4.2, 4.3_

- [x] 6. リゾルバー抽出の拡張
- [x] 6.1 Interface 型に対するフィールドリゾルバーを抽出できるようにする
  - defineField の親型として Interface 型を許可する
  - TypeExtension として Interface へのフィールド追加を記録する
  - _Requirements: 5.3_

- [x] 6.2 Interface を返すフィールドの戻り型推論を実装する
  - Interface を返すフィールドを検出する
  - 戻り型として Interface を実装するすべての型の union を推論する
  - __resolveType の生成は行わず、ユーザー実装に委ねる
  - _Requirements: 5.1, 5.2_

- [x] 7. Golden File テストの追加
- [x] 7.1 (P) 基本的な Interface 定義のテストケースを追加する
  - シンプルな Interface と実装型のペアを定義する
  - 生成される GraphQL スキーマが正しいことを検証する
  - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [x] 7.2 (P) 複数 Interface 実装のテストケースを追加する
  - 型が複数の Interface を実装するケースを定義する
  - implements 句にすべての Interface が含まれることを検証する
  - _Requirements: 2.1, 2.2, 4.2, 4.3_

- [x] 7.3 (P) Interface 継承のテストケースを追加する
  - Interface が他の Interface を継承するケースを定義する
  - 継承関係が正しく出力されることを検証する
  - _Requirements: 1.1, 4.4_

- [x] 7.4 (P) エラーケースのテストケースを追加する
  - 不足フィールド、型不一致、未定義参照、循環継承のケースを定義する
  - 診断メッセージが適切に生成されることを検証する
  - _Requirements: 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4_

- [x] 7.5 (P) Interface リゾルバーのテストケースを追加する
  - Interface に対するフィールドリゾルバー定義を含むケースを定義する
  - リゾルバーマップに正しく登録されることを検証する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 8. 統合と最終検証
- [x] 8.1 パイプライン全体の統合テストを実施する
  - 型抽出からスキーマ生成までの E2E フローを検証する
  - 各コンポーネント間のデータ受け渡しが正しいことを確認する
  - _Requirements: 3.4, 4.1, 4.2, 4.3, 4.4_

- [x] 8.2 examples ディレクトリに Interface 使用例を追加する
  - Node interface のような実践的なパターンを示す
  - ドキュメントコメントを含め、使い方が明確になるようにする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

- [x] 9. バグ修正とテスト追加（PR レビュー対応）
- [x] 9.1 (P) Union 型リグレッションを修正する
  - `GqlTypeDef` で定義された型が union メンバーとして使用される場合、Union 型として認識されない問題を修正
  - `determineTypeKind` 関数で、交差型（`ts.TypeFlags.Intersection`）を持つ union メンバーも Object 型として扱うよう修正
  - `examples/full-featured` の `SearchResult` と `TimelineItem` が正しく `union` として生成されることを検証
  - _Requirements: 3.5_

- [x] 9.2 (P) 循環継承検出のテストケースを追加する
  - `interface-circular-reference` テストケースを追加し、循環検出が正しく動作することを検証
  - Interface A implements B, B implements C, C implements A のような循環パターンを定義
  - 循環経路を含むエラーメッセージが正しく生成されることを確認
  - _Requirements: 6.4_
