# Research & Design Decisions

---
**Purpose**: Subscription サポート機能の設計判断を裏付ける調査ログ。
**Usage**: design.md から参照される背景情報と詳細比較を記録する。
---

## Summary
- **Feature**: `subscription-support`
- **Discovery Scope**: Extension (既存の Query/Mutation パターンを Subscription に拡張)
- **Key Findings**:
  - GraphQL Subscription リゾルバは `{ subscribe: fn }` オブジェクト形式が graphql-tools/graphql-js の標準
  - `subscribe` 関数は `AsyncIterable` を返す必要がある (graphql-js v16+)
  - 既存の `defineQuery`/`defineMutation` パターンは `DefineApiResolverType`, `ResolverKind`, `ResolverMetadataShape` を拡張するだけで Subscription に対応可能

## Research Log

### GraphQL Subscription Resolver Format (graphql-tools 互換)
- **Context**: Subscription リゾルバの resolver map 形式を確認する必要がある
- **Sources Consulted**:
  - [graphql-js 公式ドキュメント: Subscriptions](https://www.graphql-js.org/docs/subscriptions/)
  - [graphql-subscriptions npm](https://www.npmjs.com/package/graphql-subscriptions)
  - [Apollo Server: Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions)
- **Findings**:
  - graphql-tools の `makeExecutableSchema` における Subscription リゾルバ形式:
    ```typescript
    {
      Subscription: {
        fieldName: {
          subscribe: (root, args, context, info) => AsyncIterable<T>
        }
      }
    }
    ```
  - Query/Mutation リゾルバが直接関数を返すのに対し、Subscription は `{ subscribe: fn }` オブジェクトが必須
  - `subscribe` 関数の返り値は `AsyncIterable<T>` または `Promise<AsyncIterable<T>>`
  - graphql-js v16 以降は `AsyncIterator` ではなく `AsyncIterable` が推奨
  - async generator 関数 (`async function*`) は `AsyncIterable` を返すため直接利用可能
- **Implications**:
  - code-emitter で Subscription リゾルバのみ `{ subscribe: resolverFn }` ラップが必要
  - Query/Mutation は `fieldName: resolverFn` の直接参照だが、Subscription は一段ネストされる

### 既存コードベースの拡張ポイント分析
- **Context**: 最小限の変更で Subscription を追加するための拡張ポイントを特定
- **Sources Consulted**: プロジェクトソースコード
- **Findings**:
  - `@gqlkit-ts/runtime`:
    - `ResolverKind` 型に `"subscription"` を追加
    - `QueryResolver`/`MutationResolver` パターンに倣い `SubscriptionResolver` 型を追加
    - `GqlkitApis` interface に `defineSubscription` メソッドを追加
    - `createGqlkitApis` 実装にパススルー関数を追加
  - `@gqlkit-ts/cli` resolver-extractor:
    - `DefineApiResolverType` に `"subscription"` を追加
    - `detectResolverFromMetadataType` は既にメタデータベースの検出を行っているため、`"subscription"` の追加は kind チェックの条件追加のみ
    - `extractTypeArgumentsFromCall` は Query/Mutation と同じ型引数パターン (TArgs, TResult, TDirectives) のため変更不要
    - `INVALID_DEFINE_CALL` のエラー検出正規表現に `Subscription` を追加
  - `@gqlkit-ts/cli` orchestrator:
    - `convertDefineApiToFields` に subscription 分岐を追加
    - `ResolversResult` に `subscriptionFields` を追加
    - `ExtractResolversResult` に `subscriptionFields` を追加
  - `@gqlkit-ts/cli` schema-generator:
    - `IntegratedResult` に `hasSubscription` フラグを追加
    - `integrate` 関数で Subscription の baseType と typeExtension を生成
    - `ast-builder` は既存の ObjectTypeDefinition/Extension 生成ロジックをそのまま利用
    - `code-emitter` で Subscription フィールドのリゾルバ出力を `{ subscribe: fn }` 形式に変更
  - auto-type-generator:
    - `ResolverType` に `"subscription"` を追加
    - `forEachResolverField` で subscriptionFields を走査対象に追加

## Design Decisions

### Decision: SubscriptionResolverFn のシグネチャ
- **Context**: Subscription リゾルバ関数の型をどう定義するか
- **Alternatives Considered**:
  1. `(root, args, ctx, info) => AsyncIterable<T>` -- 同期のみ
  2. `(root, args, ctx, info) => AsyncIterable<T> | Promise<AsyncIterable<T>>` -- 非同期初期化もサポート
- **Selected Approach**: Option 2
- **Rationale**: PubSub 接続の初期化など非同期処理が必要なケースが多い。graphql-js の subscribe 関数も `Promise<AsyncIterable>` を受け付ける
- **Trade-offs**: 型が若干複雑になるが、実用上必須の柔軟性
- **Follow-up**: なし

### Decision: TResult の意味 -- AsyncIterable のイテレーション結果型
- **Context**: `defineSubscription<TArgs, TResult>` における `TResult` が何を表すか
- **Alternatives Considered**:
  1. `TResult` = `AsyncIterable<T>` 全体 -- ユーザーが AsyncIterable を明示
  2. `TResult` = イテレーション結果の型 T -- AsyncIterable<T> は自動導出
- **Selected Approach**: Option 2
- **Rationale**: `defineQuery<Args, User>` が `User | Promise<User>` を返す関数を受け取るのと一貫性がある。ユーザーは「Subscription フィールドが配信するデータの型」だけを指定すればよい。GraphQL スキーマ上の戻り値型も `TResult` がそのまま使われる (AsyncIterable ラップなし)
- **Trade-offs**: なし。これが最も直感的
- **Follow-up**: なし

### Decision: code-emitter での Subscription リゾルバ出力形式
- **Context**: resolver map 生成時に Subscription フィールドをどう出力するか
- **Alternatives Considered**:
  1. Query/Mutation と同じ直接参照形式 (`fieldName: resolverFn`)
  2. `{ subscribe: resolverFn }` ラップ形式
- **Selected Approach**: Option 2
- **Rationale**: graphql-tools の `makeExecutableSchema` が Subscription リゾルバに `{ subscribe: fn }` オブジェクト形式を要求するため、互換性のためにこの形式が必須
- **Trade-offs**: code-emitter に Subscription 固有のロジック追加が必要
- **Follow-up**: なし

## Risks & Mitigations
- **Risk**: Subscription フィールドの `TResult` が `AsyncIterable<T>` のまま GraphQL スキーマ型に変換されるリスク
  - **Mitigation**: スキーマ生成では `TResult` をそのまま使用し、`AsyncIterable` ラップは行わない (型抽出段階で `TResult` はイテレーション結果型のみ)
- **Risk**: 既存の auto-type-generator テストが Subscription 追加で壊れるリスク
  - **Mitigation**: Subscription は新しい resolver type として追加されるため、既存テストに影響なし。新規テストケースで Subscription 固有の動作を検証

## References
- [GraphQL.js Subscriptions Documentation](https://www.graphql-js.org/docs/subscriptions/) -- graphql-js の subscribe 関数と AsyncIterable の仕様
- [graphql-subscriptions npm](https://www.npmjs.com/package/graphql-subscriptions) -- PubSub パターンの参考
- [Apollo Server Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions) -- `{ subscribe: fn }` 形式の仕様確認
