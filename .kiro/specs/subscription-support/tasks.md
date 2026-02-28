# Implementation Plan

- [ ] 1. Runtime 層: `defineSubscription` API と関連型の追加
- [x] 1.1 (P) Subscription リゾルバの型定義を追加する
  - `SubscriptionResolverFn<TArgs, TResult, TContext>` 型を定義し export する。シグネチャは `(root: undefined, args: TArgs, context: TContext, info: GraphQLResolveInfo) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>`
  - `SubscriptionResolver<TArgs, TResult, TContext, TDirectives>` 型を定義し export する。`SubscriptionResolverFn` と `" $gqlkitResolver"` メタデータ (`kind: "subscription"`) の intersection 型とする
  - `ResolverKind` union 型に `"subscription"` を追加する
  - `ResolverMetadataShape` の既存プロパティ (`kind`, `args`, `result`) で subscription メタデータが表現可能であることを確認する（型の変更は不要）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 1.2 (P) `GqlkitApis` に `defineSubscription` メソッドを追加する
  - `GqlkitApis<TContext>` interface に `defineSubscription` メソッド定義を追加する。型引数パターンは `defineQuery` と同一 (`TArgs`, `TResult`, `TDirectives`)
  - `createGqlkitApis()` の実装に `defineSubscription` パススルー関数 (`(resolver) => resolver`) を追加する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. CLI リゾルバ抽出: Subscription リゾルバの認識と型情報抽出
- [x] 2.1 `DefineApiResolverType` と検出ロジックを拡張する
  - `DefineApiResolverType` union に `"subscription"` を追加する
  - `detectResolverFromMetadataType` の kind チェック条件に `"subscription"` を追加する
  - 複雑式検出の正規表現を `/define(Query|Mutation|Field|Subscription)/` に更新する
  - `extractTypeArgumentsFromCall` は subscription を Query/Mutation と同じパス（非 field パス）で処理するため変更不要であることを確認する
  - フィールド名解決 (`$` 区切り)、TSDoc 情報抽出、エラー検出は既存ロジックがそのまま適用されることを確認する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4_

- [ ] 3. CLI オーケストレータ: Subscription フィールドのデータフロー追加
- [ ] 3.1 `ResolversResult` と `ExtractResolversResult` に `subscriptionFields` を追加する
  - `ResolversResult` interface に `subscriptionFields: { fields: ReadonlyArray<GraphQLFieldDefinition> }` プロパティを追加する
  - `ExtractResolversResult` interface に同等の `subscriptionFields` プロパティを追加する
  - `convertDefineApiToFields` で `resolverType === "subscription"` の分岐を追加し、subscription リゾルバを `subscriptionFields` に振り分ける
  - `extractResolversCore` の返り値に `subscriptionFields` を含める
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. CLI 自動型生成: Subscription フィールドの走査対象追加
- [ ] 4.1 (P) `forEachResolverField` で `subscriptionFields` をイテレーション対象に追加する
  - `ResolverType` union に `"subscription"` を追加する
  - `forEachResolverField` に `resolversResult.subscriptionFields.fields` をイテレーションするループを追加し、`resolverType: "subscription"`, `parentTypeName: null` で visitor を呼び出す
  - これにより auto-type-generator の各 collector（inline-object, inline-union, inline-enum, naming-convention）が自動的に subscription フィールドも対象にする
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 5. CLI スキーマ生成: Result Integrator に Subscription サポートを追加
- [ ] 5.1 `IntegratedResult` に `hasSubscription` フラグを追加し、統合ロジックを拡張する
  - `IntegratedResult` interface に `hasSubscription: boolean` プロパティを追加する
  - `integrate` 関数で `subscriptionFields.fields.length > 0` を判定し、true の場合に `type Subscription` の baseType と typeExtension を生成する
  - subscription フィールドが0件の場合はスキーマに含めない
  - 既存の `hasQuery`/`hasMutation` パターンと同一の処理を踏襲する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 6. CLI コード生成: Subscription リゾルバの `{ subscribe: fn }` ラップ出力
- [ ] 6.1 `buildTypeResolverEntry` を拡張し、Subscription フィールドのリゾルバ出力形式を分岐する
  - `typeName === "Subscription"` の場合、各フィールドエントリを `fieldName: { subscribe: localName }` 形式で出力するロジックを追加する
  - `directExport` パターンと非 `directExport` パターンの両方で正しい `{ subscribe: ... }` ラップを生成する
  - 非 Subscription 型の場合は既存ロジックを維持し影響を与えない
  - import 文の収集・ソートは既存ロジックがそのまま動作することを確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Golden file テスト: Subscription サポートの検証
- [ ] 7.1 基本的な subscription の golden file テストケースを追加する
  - `defineSubscription<Args, Result>` の基本パターンで `type Subscription` がスキーマに含まれ、resolver map に `{ subscribe: fn }` 形式が出力されることを検証する
  - 引数なし subscription（`NoArgs` 使用）が正しく生成されることを検証する
  - 複数 subscription フィールドのソート順序と resolver map 構造を検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7.2 (P) Query/Mutation/Subscription 混在テストケースを追加する
  - 3 種の root operation type が共存する場合の統合結果を検証する
  - subscription のみ（Query/Mutation なし）が定義された場合に `type Subscription` のみが生成されることを検証する
  - _Requirements: 4.1, 4.4_

- [ ] 7.3 (P) ディレクティブ・TSDoc・インライン引数型の golden file テストケースを追加する
  - `TDirectives` 型引数によるディレクティブ付与を検証する
  - TSDoc コメントからの description と `@deprecated` の抽出を検証する
  - 引数にインラインオブジェクト型を使用した場合の auto-type 生成と `{PascalCaseFieldName}{PascalCaseArgName}Input` 命名規則を検証する
  - _Requirements: 3.5, 4.3, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7.4 (P) エラーケースの golden file テストケースを追加する
  - `defineSubscription` に型引数が不足した場合のエラー diagnostic を検証する
  - 空フィールド名 (`subscription$` パターン) のエラーを検証する
  - 複雑式（条件式・バイナリ式）内で `defineSubscription` を使用した場合のエラーを検証する
  - _Requirements: 7.1, 7.2, 7.3, 7.4_
