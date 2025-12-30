# Research & Design Decisions

## Summary

- **Feature**: resolver-define-api
- **Discovery Scope**: New Feature (新規 API 追加、既存システムとの統合)
- **Key Findings**:
  - Vue/Pinia の `defineComponent`/`defineStore` パターンが参考になる
  - GraphQL Code Generator の resolver 型パターンが業界標準
  - TypeScript のモジュール拡張で Context 型を宣言的に定義可能
  - 既存の `resolver-extractor` パイプラインの出力形式（`AnalyzedResolver`/`AnalyzedField`）は再利用可能
  - パッケージ名は `@gqlkit-ts/runtime` に統一（既存の `@gqlkit-ts/cli` との整合性）

## Research Log

### TypeScript ユーティリティ関数パターン

- **Context**: gqlkit の新 API として `defineQuery`、`defineMutation`、`defineField` を設計するにあたり、既存の成功事例を調査
- **Sources Consulted**:
  - [TypeScript Generics Documentation](https://www.typescriptlang.org/docs/handbook/2/generics.html)
  - [Vue.js TypeScript with Composition API](https://vuejs.org/guide/typescript/composition-api)
  - [Vue RFCs Discussion #436](https://github.com/vuejs/rfcs/discussions/436)
- **Findings**:
  - Vue の `defineComponent` は型推論を最大化するためにジェネリクスを活用
  - 型引数の推論は関数の引数から自動的に行われる（Type Argument Inference）
  - 複雑なケースでは明示的な型パラメータが必要
  - `NoInfer<Type>` を使用して意図しない型推論を防ぐことが可能
- **Implications**:
  - `defineQuery<Args, Return>` の形式で明示的な型パラメータを要求する設計が適切
  - 引数なしの場合は `Args = never` をデフォルトとして条件型で処理

### GraphQL Resolver の型定義パターン

- **Context**: GraphQL リゾルバの標準的な型定義パターンを調査
- **Sources Consulted**:
  - [GraphQL Code Generator - TypeScript Resolvers](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-resolvers)
  - [Better Type Safety for Resolvers](https://the-guild.dev/blog/better-type-safety-for-resolvers-with-graphql-codegen)
  - [Apollo Resolvers Documentation](https://www.apollographql.com/docs/apollo-server/data/resolvers)
- **Findings**:
  - 標準的なリゾルバシグネチャは `(parent, args, context, info)` の4パラメータ
  - Context 型は設定で指定し、すべてのリゾルバに適用される
  - `GraphQLResolveInfo` は graphql パッケージから提供される
  - カスタム `ResolveFn` を定義して `<TResult, TParent, TContext, TArgs>` のジェネリクスを使用可能
- **Implications**:
  - 4パラメータシグネチャを採用（graphql-tools 互換性のため）
  - Context 型はグローバル設定として定義可能にする
  - `graphql` パッケージを peer dependency として依存

### Context 型のグローバル設定方法

- **Context**: ユーザーが定義した Context 型をすべてのリゾルバに適用する方法を調査
- **Sources Consulted**:
  - [TypeScript Module Augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
  - [GraphQL Modules Type-Safety](https://the-guild.dev/graphql/modules/docs/essentials/type-safety)
- **Findings**:
  - GraphQL Modules は `GraphQLModules.Context` グローバルインターフェースを使用
  - TypeScript のモジュール拡張（declaration merging）でグローバル型を拡張可能
  - `declare global { namespace X { interface Y {} } }` パターンが一般的
- **Implications**:
  - `Gqlkit.Context` インターフェースをグローバル名前空間で宣言
  - ユーザーはモジュール拡張で自身の Context 型を追加
  - 未定義の場合は `unknown` にフォールバック

### 既存 gqlkit コードベースの分析

- **Context**: 既存の resolver-extractor との統合方法を検討
- **Sources Consulted**: gqlkit ソースコード
- **Findings**:
  - 現在は `XxxResolver` 型 + `xxxResolver` 値のペアパターンを検出
  - `extractResolversFromProgram` が TypeScript AST を解析
  - `analyzeSignatures` が関数シグネチャから型情報を抽出
  - `ResolverCategory` は "query" | "mutation" | "type" の3種類
- **Implications**:
  - 新 API の抽出ロジックを追加し、既存ロジックと結果をマージ
  - `ResolverCategory` を再利用可能
  - 新しい抽出結果を `AnalyzedResolver` 形式に変換して統合

### 既存 resolver-extractor パイプラインの詳細分析

- **Context**: 新 API との統合ポイントを特定するため、既存パイプラインを詳細に分析
- **Sources Consulted**: `packages/cli/src/resolver-extractor/` ソースコード
- **Findings**:
  - パイプライン構成:
    ```
    scanResolverDirectory → extractResolversFromProgram → analyzeSignatures → convertToFields
    ```
  - `ResolverPair` 型: type と value のペア情報を保持
    - `typeName`: "QueryResolver" などの型名
    - `valueName`: "queryResolver" などの値名
    - `category`: "query" | "mutation" | "type"
    - `targetTypeName`: "Query" | "Mutation" | カスタム型名
    - `typeSymbol` / `valueSymbol`: TypeScript シンボル
  - `AnalyzedField` 型: フィールドシグネチャ情報
    - `name`: フィールド名
    - `parentType?`: 親型（Field リゾルバのみ）
    - `args?`: 引数定義配列
    - `returnType`: 戻り値型
  - 現在の API は 1-2 パラメータ（`args` または `parent, args`）
  - 新 API は 4 パラメータ（`root/parent, args, context, info`）
- **Implications**:
  - `AnalyzedField` / `AnalyzedResolver` 型はそのまま再利用可能
  - 新 API では `ResolverPair` に相当する中間表現が不要（直接 `AnalyzedField` を生成）
  - `convertToFields` 以降のパイプラインは変更不要
  - 混在検出は `extractResolvers` 関数内で両方の抽出後に実施

### GraphQL Resolver 型定義の標準パターン（2025年調査）

- **Context**: GraphQL リゾルバの最新型定義パターンを調査
- **Sources Consulted**:
  - [GraphQL Code Generator - TypeScript Resolvers](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-resolvers)
  - [Apollo Resolvers Documentation](https://www.apollographql.com/docs/apollo-server/data/resolvers)
- **Findings**:
  - 標準的なリゾルバシグネチャ: `(parent, args, context, info) => Promise<TResult> | TResult`
  - `GraphQLResolveInfo` は graphql パッケージから提供
  - `IFieldResolver<TSource, TContext, TArgs, TReturn>` パターンが一般的
  - `info` パラメータはオプショナルにできる（テスト時の利便性）
  - Context 型は設定で指定し、すべてのリゾルバに適用
- **Implications**:
  - 4 パラメータシグネチャを採用（graphql-tools 互換性のため）
  - `graphql` パッケージを peer dependency として依存
  - `info` パラメータは必須として定義（オプショナル化は将来検討）

### TypeScript モジュール拡張パターン（2025年調査）

- **Context**: Context 型のグローバル設定方法について最新パターンを調査
- **Sources Consulted**:
  - [TypeScript Documentation - Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
  - [TypeScript Documentation - Global: Modifying Module](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/global-modifying-module-d-ts.html)
- **Findings**:
  - `declare global { namespace X { interface Y {} } }` パターンが一般的
  - `.d.ts` ファイルでの宣言が推奨（型のみのファイルであることを明示）
  - 同名の `.ts` ファイルが存在する場合、`.d.ts` は無視される可能性あり
  - グローバル名前空間の汚染に注意が必要
  - declaration merging は既存のインターフェースを拡張可能
- **Implications**:
  - `Gqlkit.Context` インターフェースをグローバル名前空間で宣言
  - ユーザーは `gqlkit.d.ts` などのファイルで Context を拡張
  - 未定義の場合は `unknown` にフォールバック（条件型で実現）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 関数ラッパーパターン | defineXxx 関数でリゾルバをラップ | 型安全、明示的、IDE 補完良好 | 静的解析が必要 | Vue/Pinia の成功事例あり |
| デコレータパターン | @Query() などのデコレータ | 宣言的、メタデータ活用 | gqlkit 設計原則に反する | 採用しない |
| 型推論パターン | 型のみから推論 | 実装シンプル | 型情報だけでは不十分 | Query/Mutation の区別が困難 |

## Design Decisions

### Decision: 関数ラッパーパターンの採用

- **Context**: リゾルバ定義 API の基本パターンを決定する必要がある
- **Alternatives Considered**:
  1. デコレータパターン — `@Query() user() { }` 形式
  2. 型推論パターン — 型シグネチャのみから解析
  3. 関数ラッパーパターン — `defineQuery(...)` 形式
- **Selected Approach**: 関数ラッパーパターン
- **Rationale**:
  - gqlkit の「デコレータ不使用」原則に適合
  - Vue/Pinia で実績のあるパターン
  - 静的解析で検出可能かつ型安全
- **Trade-offs**:
  - 利点: 明示的、型安全、IDE サポート良好
  - 欠点: define* 呼び出しが必要（ボイラープレート）
- **Follow-up**: 型推論の複雑さを実装時に検証

### Decision: モジュール拡張による Context 型定義

- **Context**: ユーザー定義の Context 型をリゾルバに適用する方法
- **Alternatives Considered**:
  1. ジェネリクス引数として毎回指定
  2. 設定ファイルで指定
  3. モジュール拡張でグローバル定義
- **Selected Approach**: モジュール拡張
- **Rationale**:
  - 一度の宣言でプロジェクト全体に適用
  - TypeScript の標準機能を活用
  - GraphQL Modules と同様のパターン
- **Trade-offs**:
  - 利点: DRY、型システムで完結
  - 欠点: グローバル名前空間の使用
- **Follow-up**: 名前空間の衝突可能性を評価

### Decision: 新パッケージ @gqlkit-ts/runtime の作成

- **Context**: define* 関数をどのパッケージから提供するか
- **Alternatives Considered**:
  1. @gqlkit-ts/cli に含める — CLI とランタイムが密結合になる
  2. 新規パッケージ @gqlkit/core — 既存の `@gqlkit-ts/cli` と命名規則が不整合
  3. 新規パッケージ @gqlkit-ts/runtime — 既存命名規則に準拠
- **Selected Approach**: 新規パッケージ `@gqlkit-ts/runtime`
- **Rationale**:
  - ユーザープロジェクトの依存を最小化
  - CLI ツールとランタイム型を分離
  - 既存の `@gqlkit-ts/cli` と命名規則が一貫
  - 将来的な拡張に対応しやすい
- **Trade-offs**:
  - 利点: 軽量、明確な責務分離、命名一貫性
  - 欠点: パッケージ管理の複雑さ増加（monorepo で軽減）
- **Follow-up**: pnpm workspace でのパッケージ管理設定を確認

## Risks & Mitigations

- **TypeScript 型推論の複雑さ** — 条件型の使用を最小限に抑え、明示的な型パラメータを推奨
- **静的解析の限界** — 複雑な式での define* 呼び出しはエラーとして報告し、シンプルなパターンのみサポート
- **既存 API との互換性** — 旧 API との混在を禁止し、完全移行を強制。エラーメッセージで移行手順を案内
- **Parent 型解決の困難さ** — 型エイリアスのチェーンを追跡し、元の型名を解決するロジックを実装
- **4 パラメータへの移行** — 現在の 1-2 パラメータから 4 パラメータへの変更は破壊的。移行ガイドを用意
- **@gqlkit-ts/runtime のインポート検出** — TypeScript Compiler API でシンボルの宣言元を追跡し、@gqlkit-ts/runtime からのインポートかを確認

## References

### 公式ドキュメント
- [TypeScript Generics Documentation](https://www.typescriptlang.org/docs/handbook/2/generics.html) — ジェネリクスの基本と型推論
- [TypeScript Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) — モジュール拡張パターン
- [TypeScript Global Modifying Module](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/global-modifying-module-d-ts.html) — グローバル型拡張

### フレームワーク参考
- [Vue.js TypeScript Guide](https://vuejs.org/guide/typescript/composition-api) — defineComponent パターンの参考
- [Vue RFCs Discussion #436](https://github.com/vuejs/rfcs/discussions/436) — define* 関数の設計議論

### GraphQL 関連
- [GraphQL Code Generator - TypeScript Resolvers](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-resolvers) — リゾルバ型生成のベストプラクティス
- [GraphQL Modules Type-Safety](https://the-guild.dev/graphql/modules/docs/essentials/type-safety) — Context 型のグローバル定義パターン
- [Apollo Resolvers Documentation](https://www.apollographql.com/docs/apollo-server/data/resolvers) — GraphQL リゾルバの標準パラメータ

### 内部ソースコード
- `packages/cli/src/resolver-extractor/` — 既存の resolver-extractor 実装
- `packages/cli/src/resolver-extractor/extractor/resolver-extractor.ts` — ResolverPair 抽出ロジック
- `packages/cli/src/resolver-extractor/analyzer/signature-analyzer.ts` — シグネチャ解析ロジック
