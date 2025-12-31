# Requirements Document

## Introduction

gqlkit の `define-api-extractor.ts` には、re-export パターンを使用した場合に resolver が検出されないクリティカルなバグが存在する。現在の実装では `findCreateGqlkitApisDestructuring` 関数が各ファイル内でのみ `createGqlkitApis()` の分割代入を検索するため、別ファイルから re-export された `defineQuery`/`defineMutation`/`defineField` 関数を使用するユースケースが動作しない。

examples ディレクトリで推奨されているパターン:
```typescript
// gqlkit.ts - createGqlkitApis を呼び出し、分割代入して re-export
import { createGqlkitApis } from "@gqlkit-ts/runtime";
export const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();

// resolvers/queries.ts - re-export された関数をインポートして使用
import { defineQuery } from "../gqlkit.js";
export const user = defineQuery<NoArgs, User>(() => ...);
```

この仕様は、re-export パターンでの resolver 検出を修正し、関連するコード品質の問題も解消する。

## Requirements

### Requirement 1: Re-export された Define API 関数の検出

**Objective:** As a gqlkit ユーザー, I want 別ファイルから re-export された `defineQuery`/`defineMutation`/`defineField` 関数を使用しても resolver が正しく検出されること, so that 推奨されるプロジェクト構成（gqlkit.ts で共通設定を定義し、resolver ファイルでインポートするパターン）が動作する

#### Acceptance Criteria

1. When resolver ファイルが `gqlkit.ts` などの中間ファイルから `defineQuery` をインポートして使用している場合, the Define API Extractor shall 当該 resolver を正しく抽出する
2. When resolver ファイルが中間ファイルから `defineMutation` をインポートして使用している場合, the Define API Extractor shall 当該 resolver を正しく抽出する
3. When resolver ファイルが中間ファイルから `defineField` をインポートして使用している場合, the Define API Extractor shall 当該 resolver を正しく抽出する
4. When 中間ファイルで名前を変更して export している場合（例: `export const myQuery = defineQuery`）, the Define API Extractor shall ブランド型（`QueryResolver`/`MutationResolver`/`FieldResolver`）を検査して resolver を正しく抽出する
5. The Define API Extractor shall TypeScript の型チェッカーを使用して、関数の戻り値型がブランド型かどうかを判定することで resolver を識別する

### Requirement 2: ブランド型検出による統一的な処理

**Objective:** As a gqlkit ユーザー, I want ブランド型検出により全てのパターン（同一ファイル、re-export）が統一的に処理されること, so that どのパターンでも resolver が正しく検出される

#### Acceptance Criteria

1. The Define API Extractor shall ブランド型検出のみを使用し、従来の `findCreateGqlkitApisDestructuring` は削除する

### Requirement 3: 冗長なチェックの削除

**Objective:** As a gqlkit 開発者, I want コード内の冗長なチェックを削除すること, so that コードの保守性と可読性が向上する

#### Acceptance Criteria

1. The `isCreateGqlkitApisCall` 関数 shall `RUNTIME_PACKAGE` 定数を一度だけ使用し、ハードコードされた重複文字列 `"@gqlkit-ts/runtime"` を削除する
2. The Define API Extractor shall 冗長なチェックを削除しても既存の動作に影響を与えない

### Requirement 4: 検出スキップ時の警告

**Objective:** As a gqlkit ユーザー, I want ブランド型を持たない export がスキップされた場合に警告を得られること, so that 意図しないスキップに気づける

#### Acceptance Criteria

1. When エクスポートされた関数呼び出しがブランド型を持たない場合, the Define API Extractor shall 警告を出力してスキップする
2. The Define API Extractor shall 検出に成功した resolver の数を報告する

### Requirement 5: 多段階 Re-export のサポート

**Objective:** As a gqlkit ユーザー, I want 複数のファイルを経由した re-export パターンでも resolver が検出されること, so that プロジェクトの構成に柔軟性を持たせられる

#### Acceptance Criteria

1. When Define API 関数が複数のファイルを経由して re-export されている場合（例: `runtime` -> `gqlkit.ts` -> `utils/index.ts` -> resolver）, the Define API Extractor shall import チェーンを完全にトレースして resolver を正しく抽出する
2. While import チェーンをトレースしている間, the Define API Extractor shall 循環参照を検出した場合は無限ループを回避し、適切なエラーを報告する

