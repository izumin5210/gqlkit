# Requirements Document

## Introduction

本ドキュメントは、gqlkitの「type-extraction」機能の要件を定義する。この機能は、指定ディレクトリ配下でexportされているTypeScript型定義を解析し、対応するGraphQL型情報を構造化されたオブジェクトとして出力する。gqlkitのコード生成パイプラインにおける基盤機能であり、後続のスキーマAST生成やリゾルバマップ生成の入力となる。

## Requirements

### Requirement 1: TypeScript型のスキャンと検出

**Objective:** As a gqlkit利用者, I want 指定ディレクトリ配下のexportされたTypeScript型を自動検出してほしい, so that 手動での型登録なしにGraphQL型を生成できる

#### Acceptance Criteria

1. When ディレクトリパスが指定された場合, the type-extractor shall そのディレクトリ配下の全TypeScriptファイルを再帰的にスキャンする
2. When TypeScriptファイルがスキャンされた場合, the type-extractor shall exportされた型定義（type, interface）を検出する
3. When exportされていない型定義が存在する場合, the type-extractor shall その型をGraphQL型変換の対象から除外する
4. The type-extractor shall 検出した型の名前、種別（type/interface）、ソースファイルパスを記録する

### Requirement 2: TypeScript型からGraphQL型への変換

**Objective:** As a gqlkit利用者, I want TypeScriptの型定義がGraphQL型に自動変換されてほしい, so that TypeScriptの型定義だけでGraphQLスキーマを構築できる

#### Acceptance Criteria

1. When TypeScriptのobject type または interface が検出された場合, the type-extractor shall GraphQL Object型として変換する
2. When TypeScriptのunion typeが検出された場合, the type-extractor shall GraphQL Union型として変換する
3. When フィールドの型がnullableである場合（`T | null` または `T | undefined`）, the type-extractor shall GraphQL型をnullableとして記録する
4. When フィールドの型が配列である場合（`T[]` または `Array<T>`）, the type-extractor shall GraphQL List型として記録する
5. When フィールドの型がプリミティブ型（string, number, boolean）である場合, the type-extractor shall 対応するGraphQLスカラー型（String, Int/Float, Boolean）に変換する
6. When 型名がGraphQL組み込み型と競合する場合, the type-extractor shall エラーを報告する

### Requirement 3: 構造化された出力形式

**Objective:** As a gqlkit開発者, I want 型情報が構造化されたオブジェクトとして出力されてほしい, so that 後続のスキーマ生成処理で利用できる

#### Acceptance Criteria

1. The type-extractor shall 抽出した型情報を構造化されたオブジェクト（TypeScript型付き）として返却する
2. The type-extractor shall 各型について、型名、GraphQL型種別、フィールド情報を含める
3. The type-extractor shall 各フィールドについて、フィールド名、型参照、nullability、list情報を含める
4. The type-extractor shall 型間の参照関係（あるフィールドが別の抽出された型を参照している場合）を記録する
5. When 型参照が解決できない場合, the type-extractor shall エラーを報告する

### Requirement 4: 関数インターフェース

**Objective:** As a gqlkit開発者, I want 型抽出機能を関数として呼び出したい, so that コード生成パイプラインに組み込める

#### Acceptance Criteria

1. The type-extractor shall 単一の関数としてエクスポートする
2. The type-extractor shall 入力としてディレクトリパスを受け取る
3. The type-extractor shall 同期的または非同期的（Promise）に結果を返却する
4. The type-extractor shall 結果の型をTypeScriptで厳密に定義する

### Requirement 5: エラーハンドリングと診断

**Objective:** As a gqlkit利用者, I want 型抽出時の問題を明確なエラーメッセージで把握したい, so that 型定義の問題を迅速に修正できる

#### Acceptance Criteria

1. If 指定されたディレクトリが存在しない場合, the type-extractor shall ディレクトリパスを含むエラーを報告する
2. If TypeScriptファイルのパースに失敗した場合, the type-extractor shall ファイルパスと行番号を含むエラーを報告する
3. If サポートされていないTypeScript構文が検出された場合, the type-extractor shall 該当構文と対処方法を含む警告を報告する
4. The type-extractor shall 複数のエラー・警告を収集し、一括で報告する（最初のエラーで中断しない）

### Requirement 6: 決定論的な出力

**Objective:** As a gqlkit利用者, I want 同じ入力から常に同じ出力を得たい, so that ビルドの再現性を確保できる

#### Acceptance Criteria

1. The type-extractor shall 同一のソースコードに対して常に同一の出力を生成する
2. The type-extractor shall ファイルのスキャン順序に依存しない出力順序を保証する
3. The type-extractor shall 出力オブジェクト内の型とフィールドを一貫した順序（アルファベット順など）でソートする
