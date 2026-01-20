# Requirements Document

## Project Description (Input)
フィールドや引数の型定義にインラインで記述される enum, string union についても inline object と同じルールで自動で graphql enum type を生成したい

## Introduction

gqlkit はインラインオブジェクト型を自動で名前付き GraphQL 型に変換する機能を持つ。この機能を拡張し、フィールドや引数の型定義にインラインで記述された string literal union および TypeScript enum についても、同様のルールで自動的に GraphQL enum 型を生成する。これにより、ユーザーは明示的な型定義なしに enum 型を利用でき、開発効率が向上する。

## Requirements

### Requirement 1: インライン string literal union の検出と enum 型生成

**Objective:** As a gqlkit ユーザー, I want フィールドや引数の型にインラインで記述した string literal union が自動的に GraphQL enum 型として生成される, so that 明示的な型定義なしに enum を利用できる

#### Acceptance Criteria
1. When フィールドの型として string literal union (例: `"foo" | "bar" | "baz"`) が記述されている, the Type Extractor shall 対応する GraphQL enum 型を自動生成する
2. When 引数の型として string literal union が記述されている, the Type Extractor shall 対応する GraphQL enum 型を自動生成する
3. When nullable な string literal union (例: `"foo" | "bar" | null`) が記述されている, the Type Extractor shall null を除外した enum 型を生成し、nullable として扱う
4. The Type Extractor shall string literal union の各メンバーを SCREAMING_SNAKE_CASE に変換して GraphQL enum 値として出力する

### Requirement 2: インライン enum 型の検出と GraphQL enum 型生成

**Objective:** As a gqlkit ユーザー, I want フィールドや引数の型にインラインで参照した TypeScript enum が自動的に GraphQL enum 型として生成される, so that 既存の TypeScript enum をそのまま活用できる

#### Acceptance Criteria
1. When フィールドの型としてスキーマ外で定義された TypeScript enum が使用されている, the Type Extractor shall 対応する GraphQL enum 型を自動生成する
2. When 引数の型としてスキーマ外で定義された TypeScript enum が使用されている, the Type Extractor shall 対応する GraphQL enum 型を自動生成する
3. When TypeScript enum がスキーマディレクトリ内でエクスポートされている, the Type Extractor shall 従来通り knownTypeNames として扱い自動生成しない
4. The Type Extractor shall TypeScript enum の値を SCREAMING_SNAKE_CASE に変換して GraphQL enum 値として出力する

### Requirement 3: 自動生成 enum 型の命名規則

**Objective:** As a gqlkit ユーザー, I want 自動生成される enum 型名が予測可能なルールに従う, so that 生成されるスキーマの構造を把握しやすい

#### Acceptance Criteria
1. When オブジェクト型のフィールドにインライン enum/string union が使用されている, the Auto-Type Generator shall `{ParentTypeName}{PascalCaseFieldName}` の形式で enum 型名を生成する
2. When 入力型のフィールドにインライン enum/string union が使用されている, the Auto-Type Generator shall `{ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input` の形式で enum 型名を生成する
3. When Query/Mutation の引数にインライン enum/string union が使用されている, the Auto-Type Generator shall `{PascalCaseFieldName}{PascalCaseArgName}Input` の形式で enum 型名を生成する
4. When フィールドリゾルバの引数にインライン enum/string union が使用されている, the Auto-Type Generator shall `{ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input` の形式で enum 型名を生成する

### Requirement 4: 配列内のインライン enum の処理

**Objective:** As a gqlkit ユーザー, I want 配列型の要素として定義したインライン enum も正しく処理される, so that 複雑な型定義でも一貫した動作を期待できる

#### Acceptance Criteria
1. When フィールドの型が string literal union の配列 (例: `("foo" | "bar")[]`) である, the Type Extractor shall enum 型を自動生成し、その配列型として出力する
2. When nullable な配列要素 (例: `("foo" | "bar" | null)[]`) が使用されている, the Type Extractor shall nullable な enum 要素の配列として処理する

### Requirement 5: 重複する enum 定義の処理

**Objective:** As a gqlkit ユーザー, I want 同一の enum 値セットが複数箇所で使用されても、型の一貫性を保つ, so that スキーマの整合性が維持される

#### Acceptance Criteria
1. When 同一の string literal union が異なるフィールドで使用されている, the Auto-Type Generator shall それぞれ独立した enum 型として生成する
2. When 同一のスキーマ外 TypeScript enum が複数箇所で参照されている, the Auto-Type Generator shall 単一の GraphQL enum 型を生成し、全ての参照箇所でそれを使用する
3. When 生成された enum 型名が既存の型名と競合する, the Schema Generator shall 明確なエラーメッセージを出力する

### Requirement 6: TSDoc コメントの反映

**Objective:** As a gqlkit ユーザー, I want TypeScript enum の TSDoc コメントが GraphQL スキーマに反映される, so that スキーマのドキュメントが充実する

#### Acceptance Criteria
1. When スキーマ外の TypeScript enum に TSDoc コメントが付与されている, the Type Extractor shall そのコメントを GraphQL enum の description として反映する
2. When TypeScript enum の各値に TSDoc コメントが付与されている, the Type Extractor shall 各 enum 値の description として反映する
3. When `@deprecated` タグが付与されている, the Type Extractor shall GraphQL の `@deprecated` ディレクティブを付与する

