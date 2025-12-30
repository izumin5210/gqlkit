# Requirements Document

## Project Description (Input)
query, mutation, field の定義を resolver object の型定義と実装から導出してた旧 API から、 define api を利用した実装から導出する新 API に移行したが、いまだ旧 API に関する実装が残されている。 gqlkit はリリース前のツールであることから後方互換は不要なので、旧 API は完全に廃止して実装・ドキュメントから削除したい。
また、 example については旧 API の実装を消すだけじゃなく新しい api で実装し直す必要がある。それも合わせて対応すること。

## Introduction

本仕様は、gqlkit のレガシー Resolver API（`*Resolver` 型/値ペア規約）を完全に廃止し、新しい Define API（`defineQuery`、`defineMutation`、`defineField`）へ統一するための要件を定義する。gqlkit はリリース前であり後方互換性は不要なため、レガシー API に関するすべての実装、テスト、ドキュメント、サンプルコードを削除・移行する。

## Requirements

### Requirement 1: レガシー Resolver API コードの削除

**Objective:** As a gqlkit 開発者, I want レガシー API の実装コードがコードベースから完全に削除されている状態, so that コードベースがシンプルになり新 API のみをサポートする明確な状態になる

#### Acceptance Criteria
1. When gqlkit gen コマンドを実行した場合, the gqlkit CLI shall `*Resolver` 型/値ペア規約に基づくリゾルバ抽出処理を実行しない
2. The gqlkit CLI shall `resolver-extractor.ts` におけるレガシー API 抽出ロジック（`extractResolversFromProgram` 関数等）を含まない
3. The gqlkit CLI shall `MISSING_RESOLVER_VALUE` および `MISSING_RESOLVER_TYPE` 診断コードを含まない
4. When コードベースをビルドした場合, the gqlkit CLI shall レガシー API に関連する型定義（`ResolverPair`、`ExtractedResolvers` 等のレガシー専用型）をエクスポートしない

### Requirement 2: Mixed API Validator の削除

**Objective:** As a gqlkit 開発者, I want レガシー API と Define API の混在検証ロジックが削除されている状態, so that 不要なコードが残らない

#### Acceptance Criteria
1. The gqlkit CLI shall `mixed-api-validator.ts` ファイルおよび関連する型定義（`ApiStyle`、`MixedApiValidationResult` 等）を含まない
2. The gqlkit CLI shall `LEGACY_API_DETECTED` 診断コードを含まない
3. When gqlkit gen コマンドを実行した場合, the gqlkit CLI shall レガシー API と Define API の混在チェックを実行しない

### Requirement 3: サンプルプロジェクトの Define API への移行

**Objective:** As a gqlkit ユーザー, I want すべてのサンプルプロジェクトが新しい Define API を使用している状態, so that 正しい使用方法を学習できる

#### Acceptance Criteria
1. When `examples/basic-types` プロジェクトを確認した場合, the サンプルコード shall `defineQuery` を使用して Query リゾルバを定義している
2. When `examples/mutations` プロジェクトを確認した場合, the サンプルコード shall `defineMutation` を使用して Mutation リゾルバを定義している
3. When `examples/type-relations` プロジェクトを確認した場合, the サンプルコード shall `defineField` を使用してオブジェクト型フィールドリゾルバを定義している
4. When `examples/type-extensions` プロジェクトを確認した場合, the サンプルコード shall `defineField` を使用して型拡張フィールドリゾルバを定義している
5. When `examples/enums` プロジェクトを確認した場合, the サンプルコード shall `defineQuery` または `defineField` を使用してリゾルバを定義している
6. When `examples/field-arguments` プロジェクトを確認した場合, the サンプルコード shall Define API を使用して引数付きフィールドリゾルバを定義している
7. The すべてのサンプルプロジェクト shall `*Resolver` 型定義および対応する `*Resolver` 値を含まない
8. When 各サンプルプロジェクトで gqlkit gen を実行した場合, the gqlkit CLI shall 正常にスキーマとリゾルバマップを生成する

### Requirement 4: ドキュメントの更新

**Objective:** As a gqlkit ユーザー, I want ドキュメントが新しい Define API のみを説明している状態, so that 正しい使用方法を理解できる

#### Acceptance Criteria
1. When `CLAUDE.md` を確認した場合, the ドキュメント shall レガシー Resolver 規約（`*Resolver` 型 + `*resolver` 値のペア規約）の説明を含まない
2. When `CLAUDE.md` を確認した場合, the ドキュメント shall `defineQuery`、`defineMutation`、`defineField` を使用した新しいリゾルバ定義方法を説明している
3. When `.kiro/steering/` 配下のファイルを確認した場合, the steering ドキュメント shall レガシー API に関する記述を含まない
4. When `.kiro/steering/` 配下のファイルを確認した場合, the steering ドキュメント shall 新しい Define API に関する正確な説明を含んでいる

### Requirement 5: テストコードの更新

**Objective:** As a gqlkit 開発者, I want レガシー API に関するテストが削除されている状態, so that テストスイートが現行の実装を正確に反映する

#### Acceptance Criteria
1. The gqlkit CLI shall `resolver-extractor.test.ts` におけるレガシー API 抽出に関するテストケースを含まない
2. The gqlkit CLI shall `mixed-api-validator.test.ts` ファイルを含まない
3. When テストスイートを実行した場合, the gqlkit CLI shall すべてのテストがパスする

### Requirement 6: エクスポート API の整理

**Objective:** As a gqlkit パッケージ利用者, I want パッケージの公開 API がレガシー関連の型を含まない状態, so that 明確で一貫性のある API を使用できる

#### Acceptance Criteria
1. When `packages/cli/src/resolver-extractor/index.ts` を確認した場合, the エクスポート shall レガシー API 専用の型（`ResolverPair`、`ExtractedResolvers`、`ResolverCategory` 等）をエクスポートしない
2. The `@gqlkit-ts/runtime` パッケージ shall `defineQuery`、`defineMutation`、`defineField`、`NoArgs`、`GqlkitContext` のみを公開 API として提供する
3. When gqlkit CLI パッケージをインポートした場合, the パッケージ shall レガシー API に関する型をエクスポートしない
