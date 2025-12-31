# Implementation Plan

## Tasks

- [x] 1. リゾルバ関数型のジェネリクス化
- [x] 1.1 (P) Query リゾルバ関数型に Context 型パラメータを追加
  - 既存の Query リゾルバ関数型に 3 番目の型パラメータとして Context 型を追加する
  - デフォルト値として既存の GqlkitContext 型を設定し後方互換性を維持する
  - 既存のグローバル define 関数が引き続き動作することを確認する
  - _Requirements: 2.1, 6.2_

- [x] 1.2 (P) Mutation リゾルバ関数型に Context 型パラメータを追加
  - 既存の Mutation リゾルバ関数型に 3 番目の型パラメータとして Context 型を追加する
  - デフォルト値として既存の GqlkitContext 型を設定し後方互換性を維持する
  - 既存のグローバル define 関数が引き続き動作することを確認する
  - _Requirements: 3.1, 6.2_

- [x] 1.3 (P) Field リゾルバ関数型に Context 型パラメータを追加
  - 既存の Field リゾルバ関数型に 4 番目の型パラメータとして Context 型を追加する
  - デフォルト値として既存の GqlkitContext 型を設定し後方互換性を維持する
  - 既存のグローバル define 関数が引き続き動作することを確認する
  - _Requirements: 4.1, 6.2_

- [x] 2. Branded Type の定義
- [x] 2.1 ResolverBrand シンボルと ResolverKind 型を定義
  - `declare const ResolverBrand: unique symbol` を定義する
  - `type ResolverKind = "query" | "mutation" | "field"` を定義する
  - ランタイムには影響を与えない型レベルのみの定義であることを確認する
  - _Requirements: 7.1, 7.4_

- [x] 2.2 (P) QueryResolver Branded Type を定義
  - QueryResolverFn と ResolverBrand の intersection type を定義する
  - ブランドに `kind: "query"`, `args`, `result` を含める
  - _Requirements: 7.1, 7.2_

- [x] 2.3 (P) MutationResolver Branded Type を定義
  - MutationResolverFn と ResolverBrand の intersection type を定義する
  - ブランドに `kind: "mutation"`, `args`, `result` を含める
  - _Requirements: 7.1, 7.2_

- [x] 2.4 (P) FieldResolver Branded Type を定義
  - FieldResolverFn と ResolverBrand の intersection type を定義する
  - ブランドに `kind: "field"`, `parent`, `args`, `result` を含める
  - _Requirements: 7.1, 7.2_

- [x] 3. GqlkitApis 型と createGqlkitApis ファクトリ関数の実装
- [x] 3.1 GqlkitApis インターフェースを定義
  - ファクトリ関数が返すオブジェクトの型を定義する
  - 型パラメータ TContext を受け取り、各 define 関数がその型を使用するようにする
  - defineQuery、defineMutation、defineField の 3 つのメソッドを含める
  - 各メソッドの戻り値型を Branded Type（QueryResolver, MutationResolver, FieldResolver）にする
  - _Requirements: 1.1, 2.2, 3.2, 4.2, 7.1_

- [x] 3.2 createGqlkitApis ファクトリ関数を実装
  - Context 型をジェネリクスで受け取るファクトリ関数を実装する
  - 未指定時は unknown 型をデフォルトとして使用する
  - 返される各 define 関数は identity 関数パターンで実装する（型アサーションで Branded Type を返す）
  - GqlkitApis 型のオブジェクトを返す
  - _Requirements: 1.1, 1.2, 1.3, 2.3, 3.3, 4.3_

- [x] 4. Runtime 単体テストの実装
- [x] 4.1 (P) createGqlkitApis ファクトリ関数の動作テスト
  - ファクトリ関数を呼び出すと 3 つの define 関数を含むオブジェクトが返ることを検証する
  - 各 define 関数が渡されたリゾルバ関数をそのまま返すことを検証する
  - 同期・非同期リゾルバの両方をサポートすることを検証する
  - _Requirements: 1.1, 2.3, 3.3, 4.3_

- [x] 4.2 (P) 複数スキーマサポートのテスト
  - 異なる型パラメータで複数回呼び出した場合に独立したセットが返ることを検証する
  - 各セットがそれぞれの Context 型に紐づいていることを検証する
  - _Requirements: 5.1, 5.2_

- [x] 5. 型テスト（コンパイル時検証）の実装
- [x] 5.1 (P) Context 型推論のテスト
  - 生成された define 関数で context 引数が指定した型として推論されることを検証する
  - Context 未指定時に unknown として扱われることを検証する
  - _Requirements: 2.1, 3.1, 4.1, 1.3_

- [x] 5.2 (P) 型不整合検出のテスト
  - 異なる Context 型の define 関数を混在使用した場合にコンパイルエラーになることを検証する
  - 誤った型のリゾルバを渡した場合にエラーになることを検証する
  - _Requirements: 5.3_

- [x] 5.3 (P) 後方互換性のテスト
  - 既存の ResolverFn 型が型パラメータなしで動作することを検証する
  - 既存のグローバル defineQuery、defineMutation、defineField が動作することを検証する
  - _Requirements: 6.2, 6.3_

- [x] 5.4 (P) Branded Type の型テスト
  - define 関数の戻り値型が ResolverBrand プロパティを持つことを検証する
  - Branded Type が関数として呼び出し可能であることを検証する
  - _Requirements: 7.1, 7.2_

- [x] 6. CLI エクストラクタの実装
- [x] 6.1 BrandedTypeExtractor を実装
  - TypeScript コンパイラ API を使用して型情報を解析する
  - ResolverBrand シンボルを持つ型をリゾルバとして識別する
  - ブランドの kind プロパティからリゾルバの種類（query/mutation/field）を判定する
  - _Requirements: 7.3_

- [x] 6.2 既存の DefineApiExtractor と統合
  - まず Branded Type を検出し、見つからない場合は従来のインポート元検出にフォールバック
  - 両方の検出方法が併存できることを確認する
  - _Requirements: 7.5_

- [x] 7. CLI 単体テストの実装
- [x] 7.1 (P) BrandedTypeExtractor の動作テスト
  - Branded Query/Mutation/Field リゾルバを正しく検出することを検証する
  - 非リゾルバ型を誤検出しないことを検証する
  - _Requirements: 7.3_

- [x] 7.2 (P) 統合テスト
  - Branded Type と従来のインポート検出が両立することを検証する
  - createGqlkitApis で定義されたリゾルバが gqlkit gen で検出されることを検証する
  - _Requirements: 7.3, 7.5_

- [x] 8. エクスポートと統合
- [x] 8.1 NoArgs 型のエクスポート維持を確認
  - 既存の NoArgs 型が引き続きエクスポートされていることを確認する
  - createGqlkitApis と組み合わせて使用できることを検証する
  - _Requirements: 6.1_

- [x] 8.2 パッケージからのエクスポートを整理
  - createGqlkitApis をパッケージのエントリポイントからエクスポートする
  - GqlkitApis 型をエクスポートする
  - Branded Resolver 型（QueryResolver, MutationResolver, FieldResolver）をエクスポートする
  - ジェネリクス化されたリゾルバ関数型をエクスポートする
  - _Requirements: 1.1, 6.2, 6.3, 7.1_
