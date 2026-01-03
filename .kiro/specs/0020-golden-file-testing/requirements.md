# Requirements Document

## Introduction

gqlkit のコード生成ツールにおけるテスト戦略を再設計する。現在は実装詳細に対する細かいユニットテストが多数存在するが、コード生成ツールにおいて最も重要なのは「入力(設定、ソースファイル)に対して期待通りの出力(生成ファイル)が得られるか」である。

本機能では、`orchestrator.ts` 内の `createSharedProgram` から `extractTypes`, `extractResolvers`, `generateSchema` までの一連のコア生成ロジックを、ファイルシステムに依存しない独立した関数として切り出す。その上で、あらゆる仕様を網羅的に検証するパラメタライズド Golden File テストを整備する。

これにより、実装詳細の変更に対して脆いユニットテストを減らし、仕様に基づいた堅牢なテストスイートを構築する。

## Requirements

### Requirement 1: コア生成ロジックの抽出

**Objective:** As a 開発者, I want コア生成ロジックをファイルシステム操作から分離した純粋関数として利用できる, so that テスト時にファイルシステムをスタブ化せずに高速にテストできる.

#### Acceptance Criteria
1. The gqlkit core generator shall 入力として型定義とリゾルバ定義を受け取る (具体的な形式は設計時に決定).
2. The gqlkit core generator shall 型抽出、リゾルバ抽出、スキーマ生成を一連のパイプラインとして実行する.
3. The gqlkit core generator shall 出力としてスキーマ AST コード、SDL コンテンツ、リゾルバコードを含む生成結果を返す.
4. The gqlkit core generator shall 出力としてすべての診断メッセージ(エラー、警告)を含む生成結果を返す.
5. The gqlkit core generator shall テスト時にファイルシステムをスタブ化せずに高速にテストできる設計とする.

#### Design Considerations
- `ts.createProgram` がファイルシステムに強く依存している場合、`ts.Program` を外部から注入可能な設計を検討する.
- ファイルシステム非依存の達成方法は、技術的制約を踏まえて設計フェーズで決定する.

### Requirement 2: Golden File テストインフラストラクチャ

**Objective:** As a 開発者, I want Golden File テストを簡単に作成・実行できる, so that 仕様に基づいた網羅的なテストを維持できる.

#### Acceptance Criteria
1. The golden file test runner shall テストケースディレクトリから入力ファイル(型定義、リゾルバ定義、設定)を読み込む.
2. The golden file test runner shall テストケースディレクトリから期待される出力ファイル(スキーマ、リゾルバ)を読み込む.
3. When テストを実行する, the golden file test runner shall コア生成関数を呼び出し、生成結果と期待される出力を比較する.
4. If 生成結果と期待される出力が一致しない, then the golden file test runner shall 差分を明確に表示する.
5. The golden file test runner shall すべてのテストケースをパラメタライズドテストとして自動的に検出・実行する.

### Requirement 3: テストケースの構造と管理

**Objective:** As a 開発者, I want テストケースを直感的な構造で管理できる, so that 新しいテストケースの追加と既存のテストケースの理解が容易になる.

#### Acceptance Criteria
1. The test case structure shall 各テストケースを識別可能な単位として管理する.
2. The test case structure shall 入力として型定義ファイルとリゾルバ定義ファイルを含む.
3. The test case structure shall 期待される出力(スキーマ、リゾルバコード)を含む.
4. Where テストケースがエラーを期待する場合, the test case structure shall 期待される診断情報を含む.
5. Where テストケースがカスタム設定を必要とする場合, the test case structure shall 設定情報を含む.

#### Design Considerations
- ディレクトリ構造の具体的な形式(例: `types/`, `resolvers/`, 出力ディレクトリ名など)は設計時に最適な方法を決定する.
- 複雑な設定を持つテストケースが多い場合、設定ファイル・tsconfig・解析対象ソースを fixtures ディレクトリとしてファイルシステム上に保持する方式も検討する.
- インラインでの定義とファイルベースの定義のトレードオフを設計時に評価する.

### Requirement 4: Golden File の更新機能

**Objective:** As a 開発者, I want 期待される出力を簡単に更新できる, so that 意図的な出力変更時にテストを素早く更新できる.

#### Acceptance Criteria
1. When 更新モードでテストを実行する, the golden file test runner shall 生成結果で期待される出力ファイルを上書きする.
2. The golden file test runner shall 環境変数またはコマンドラインオプションで更新モードを指定できる.
3. While 更新モードで実行中, the golden file test runner shall どのファイルが更新されたかをレポートする.

### Requirement 5: 既存仕様のテストカバレッジ

**Objective:** As a 開発者, I want 既存のすべての仕様が Golden File テストでカバーされている, so that リファクタリング時に仕様の破壊を検出できる.

#### Acceptance Criteria
1. The golden file test suite shall 基本的なオブジェクト型の生成をテストする.
2. The golden file test suite shall Union 型の生成をテストする.
3. The golden file test suite shall Input Object 型の生成をテストする.
4. The golden file test suite shall ブランド型スカラー(IDString, IDNumber, Int, Float)の生成をテストする.
5. The golden file test suite shall Query リゾルバの生成をテストする.
6. The golden file test suite shall Mutation リゾルバの生成をテストする.
7. The golden file test suite shall Field リゾルバの生成をテストする.
8. The golden file test suite shall TSDoc からの description 生成をテストする.
9. The golden file test suite shall `@deprecated` ディレクティブの生成をテストする.
10. The golden file test suite shall カスタムスカラー設定の適用をテストする.
11. The golden file test suite shall 型エラーの診断をテストする.
12. The golden file test suite shall リゾルバエラーの診断をテストする.


