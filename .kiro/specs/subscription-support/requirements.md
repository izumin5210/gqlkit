# Requirements Document

## Project Description (Input)
gqlkit で subscription のサポートがしたい
`defineQuery` と同じように `defineSubscription` 関数を定義し、そこに Iterator / AsyncIterator を返す関数が渡されたらそれが graphql subscription となるようなイメージ。
defineSubscription には generator / async generator 関数を渡すのがメインのユースケース
型引数は defineQuery と同じで、そこから引数に渡す関数の返り値の型の Iterator | AsyncIterator が導出されるようになってほしい。
graphql-js における subscription の実装方法や graphql subscription の仕様を調査し、この機能の仕様を定義・設計し実装してください。

## Introduction

gqlkit は現在 Query と Mutation をサポートしているが、GraphQL の三つ目のルートオペレーション型である Subscription はサポートしていない。本機能では `defineSubscription` API を `@gqlkit-ts/runtime` に追加し、`gqlkit gen` で Subscription 型のスキーマ定義およびリゾルバマップを生成できるようにする。

GraphQL Subscription のリゾルバは Query/Mutation と異なり、`subscribe` メソッドが `AsyncIterable` を返すオブジェクト形式をとる。gqlkit では `defineSubscription` に渡す関数が `AsyncIterable` (generator / async generator 関数) を返すことで、この構造を内部で生成する。型引数は `defineQuery` と同一のパターン (`TArgs`, `TResult`) を踏襲し、`TResult` から `AsyncIterable<TResult>` を導出する。

## Requirements

### Requirement 1: defineSubscription API (`@gqlkit-ts/runtime`)
**Objective:** As a gqlkit ユーザー, I want `defineSubscription` 関数を使って Subscription リゾルバを型安全に定義したい, so that Query/Mutation と一貫したパターンで Subscription を実装できる

#### Acceptance Criteria
1. The `createGqlkitApis<TContext>()` shall `defineSubscription` 関数を返すオブジェクトに含める
2. The `defineSubscription` shall `defineQuery` と同じ型引数パターン (`TArgs`, `TResult`, `TDirectives`) を受け取る
3. When `defineSubscription<TArgs, TResult>` が呼ばれたとき, the `defineSubscription` shall 引数の関数に `(root: undefined, args: TArgs, context: TContext, info: GraphQLResolveInfo) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>` というシグネチャを要求する
4. The `SubscriptionResolver` 型 shall graphql-tools 互換の `{ subscribe: SubscriptionResolverFn }` 形式のリゾルバマップ生成に必要なメタデータを `" $gqlkitResolver"` プロパティに埋め込む
5. The `SubscriptionResolver` のメタデータ shall `kind: "subscription"` を含む
6. The `defineSubscription` shall 実行時にはパススルー関数として振る舞い、渡された関数をそのまま返す（既存の define 関数と同じ挙動）

### Requirement 2: SubscriptionResolver 型定義 (`@gqlkit-ts/runtime`)
**Objective:** As a gqlkit ユーザー, I want Subscription リゾルバの型が適切に定義されていてほしい, so that コンパイル時に型チェックが効く

#### Acceptance Criteria
1. The `@gqlkit-ts/runtime` shall `SubscriptionResolverFn<TArgs, TResult, TContext>` 型を export する
2. The `SubscriptionResolverFn` shall `(root: undefined, args: TArgs, context: TContext, info: GraphQLResolveInfo) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>` と定義される
3. The `@gqlkit-ts/runtime` shall `SubscriptionResolver<TArgs, TResult, TContext, TDirectives>` 型を export する
4. The `SubscriptionResolver` shall `SubscriptionResolverFn` と `" $gqlkitResolver"` メタデータの intersection 型として定義される
5. The `ResolverKind` 型 shall `"subscription"` を union メンバーに含む
6. The `ResolverMetadataShape` shall 既存の `kind`, `args`, `result` プロパティで subscription メタデータも表現できる

### Requirement 3: CLI リゾルバ抽出での Subscription 認識 (`@gqlkit-ts/cli`)
**Objective:** As a gqlkit 開発者, I want `gqlkit gen` が `defineSubscription` で定義されたリゾルバを認識・抽出できるようにしたい, so that Subscription スキーマが自動生成される

#### Acceptance Criteria
1. When `defineSubscription` で定義された export 変数がスキャンされたとき, the resolver-extractor shall メタデータの `kind: "subscription"` を検出しリゾルバ情報を抽出する
2. The `DefineApiResolverType` shall `"subscription"` を含むように拡張される
3. When subscription リゾルバが検出されたとき, the resolver-extractor shall `TArgs` と `TResult` の型情報を Query/Mutation と同じ方法で抽出する
4. The resolver-extractor shall subscription リゾルバのエクスポート名からフィールド名を `$` 区切り規則で解決する（既存の Query/Mutation と同じ）
5. When subscription リゾルバに TSDoc コメントが付与されているとき, the resolver-extractor shall description と `@deprecated` 情報を抽出する

### Requirement 4: GraphQL スキーマ AST 生成での Subscription 型 (`@gqlkit-ts/cli`)
**Objective:** As a gqlkit ユーザー, I want `gqlkit gen` の出力する GraphQL スキーマに `type Subscription` が含まれてほしい, so that GraphQL サーバーで Subscription を利用できる

#### Acceptance Criteria
1. When 1つ以上の subscription リゾルバが定義されているとき, the schema-generator shall `type Subscription` を GraphQL スキーマ AST に含める
2. The schema-generator shall subscription リゾルバの `TResult` 型を Subscription フィールドの戻り値型として使用する（`AsyncIterable` のラップは行わない）
3. When subscription リゾルバが引数を持つとき, the schema-generator shall GraphQL フィールド引数として出力する
4. If subscription リゾルバが1つも定義されていない場合, the schema-generator shall `type Subscription` をスキーマに含めない
5. The schema-generator shall SDL 出力時に `type Subscription` を含める
6. When subscription フィールドに directive が指定されているとき, the schema-generator shall GraphQL スキーマ AST にディレクティブを含める

### Requirement 5: リゾルバマップ生成での Subscription リゾルバ (`@gqlkit-ts/cli`)
**Objective:** As a gqlkit ユーザー, I want 生成されるリゾルバマップが graphql-tools の `makeExecutableSchema` と互換性のある Subscription リゾルバ形式であってほしい, so that 既存の GraphQL サーバーフレームワークでそのまま動作する

#### Acceptance Criteria
1. The code-emitter shall Subscription リゾルバを `{ subscribe: resolverFn }` オブジェクト形式で resolver map に出力する
2. When 複数の subscription フィールドが定義されているとき, the code-emitter shall それぞれのフィールドに対して `{ subscribe: resolverFn }` オブジェクトを生成する
3. The code-emitter shall subscription リゾルバのソースファイルを import 文に含める
4. The code-emitter shall 生成するリゾルバマップの `Subscription` キー配下に全ての subscription フィールドリゾルバを配置する
5. While subscription リゾルバマップが生成されるとき, the code-emitter shall Query/Mutation と同様にフィールド名のアルファベット順でソートする

### Requirement 6: 型抽出における Subscription 関連型のサポート (`@gqlkit-ts/cli`)
**Objective:** As a gqlkit 開発者, I want subscription リゾルバの引数・戻り値で使用される型が正しく抽出されてほしい, so that スキーマ生成が既存の型サポートと一貫性を保つ

#### Acceptance Criteria
1. The type-extractor shall subscription リゾルバの引数に使用される Input 型を検出・抽出する
2. The type-extractor shall subscription リゾルバの戻り値に使用されるオブジェクト型を検出・抽出する
3. The auto-type-generator shall subscription リゾルバの引数に使用されるインライン型から名前付き GraphQL 型を自動生成する
4. When subscription リゾルバの引数にインラインオブジェクト型が使われたとき, the auto-type-generator shall `{PascalCaseFieldName}{PascalCaseArgName}Input` の命名規則で型を生成する（Query/Mutation と同じ規則）
5. The type-extractor shall subscription リゾルバで使用されるカスタムスカラー型を検出する

### Requirement 7: エラーハンドリングとバリデーション (`@gqlkit-ts/cli`)
**Objective:** As a gqlkit ユーザー, I want subscription リゾルバの定義に問題がある場合に分かりやすいエラーメッセージが表示されてほしい, so that 問題を素早く修正できる

#### Acceptance Criteria
1. If `defineSubscription` の型引数が不足しているとき, the resolver-extractor shall 適切なエラー diagnostic を出力する
2. If subscription リゾルバのエクスポート名が `$` で終わるとき（フィールド名が空）, the resolver-extractor shall エラー diagnostic を出力する
3. If subscription リゾルバの引数型がインデックスシグネチャのみの型であるとき, the resolver-extractor shall `INDEX_SIGNATURE_ONLY` エラーを出力する
4. When `defineSubscription` が複雑な式（条件式やバイナリ式）の中で使用されたとき, the resolver-extractor shall `INVALID_DEFINE_CALL` エラーを出力する

