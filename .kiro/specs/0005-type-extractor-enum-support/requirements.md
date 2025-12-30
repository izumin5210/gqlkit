# Requirements Document

## Introduction

type-extractor モジュールを拡張し、TypeScript enum および string literal union を GraphQL enum として抽出・変換する機能を追加する。これにより、gqlkit の型変換カバレッジが向上し、より多くの TypeScript パターンを GraphQL スキーマに反映できるようになる。

## Requirements

### Requirement 1: TypeScript enum の検出と抽出

**Objective:** 開発者として、TypeScript enum をエクスポートしたとき、それが GraphQL enum として認識されてほしい。これにより、既存の TypeScript enum 定義を変更せずに GraphQL スキーマで利用できる。

#### Acceptance Criteria

1. When TypeScript enum がエクスポートされたとき, the type-extractor shall その enum を "enum" kind として抽出する
2. When TypeScript enum が named export されたとき, the type-extractor shall enum 名とそのメンバー名を抽出する
3. When TypeScript enum が default export されたとき, the type-extractor shall enum 名とそのメンバー名を抽出する
4. When TypeScript の string enum（文字列値を持つ enum）が検出されたとき, the type-extractor shall 各メンバーの文字列値を保持する
5. The type-extractor shall enum メンバーの定義順序を維持する

### Requirement 2: String literal union の検出と抽出

**Objective:** 開発者として、string literal union（例: `type Status = "active" | "inactive"`）をエクスポートしたとき、それが GraphQL enum として認識されてほしい。これにより、TypeScript のイディオマティックな型定義を GraphQL enum に変換できる。

#### Acceptance Criteria

1. When type alias が string literal のみの union として定義されているとき, the type-extractor shall その型を "enum" kind として抽出する
2. When string literal union が検出されたとき, the type-extractor shall 各リテラル値を enum メンバーとして抽出する
3. When string literal union が nullable（`| null` または `| undefined`）であるとき, the type-extractor shall null/undefined を除外した string literal のみを enum メンバーとして抽出する
4. The type-extractor shall string literal union のメンバー順序を維持する

### Requirement 3: GraphQL enum への変換

**Objective:** 開発者として、抽出された enum 情報が正しく GraphQL enum 型に変換されてほしい。これにより、生成される GraphQL スキーマが有効な enum 定義を含む。

#### Acceptance Criteria

1. When TypeScript enum が抽出されたとき, the graphql-converter shall GraphQLTypeKind "Enum" として変換する
2. When string literal union が抽出されたとき, the graphql-converter shall GraphQLTypeKind "Enum" として変換する
3. When enum メンバー名に小文字が含まれるとき, the graphql-converter shall メンバー名を SCREAMING_SNAKE_CASE に変換する
4. When enum メンバー名がハイフンやスペースを含むとき, the graphql-converter shall それらをアンダースコアに置換して SCREAMING_SNAKE_CASE に変換する
5. The graphql-converter shall GraphQLTypeInfo に enumValues フィールドを含め、各値の名前と元の値を保持する

### Requirement 4: 非対応パターンのエラーハンドリング

**Objective:** 開発者として、GraphQL enum に変換できないパターンを使用したとき、明確なエラーメッセージを受け取りたい。これにより、問題の原因を素早く特定して修正できる。

#### Acceptance Criteria

1. If numeric enum（数値のみの enum）が検出されたとき, the type-extractor shall "UNSUPPORTED_ENUM_TYPE" 診断を出力し、string enum への変更を提案する
2. If heterogeneous enum（文字列と数値が混在する enum）が検出されたとき, the type-extractor shall "UNSUPPORTED_ENUM_TYPE" 診断を出力する
3. If string literal と他の型が混在する union が検出されたとき, the type-extractor shall それを enum として扱わず、通常の union として処理する
4. If const enum が検出されたとき, the type-extractor shall "UNSUPPORTED_ENUM_TYPE" 診断を出力し、通常の enum への変更を提案する
5. If enum メンバー名が GraphQL の識別子として無効な文字を含むとき, the graphql-converter shall "INVALID_ENUM_MEMBER" 診断を出力する

### Requirement 5: 既存機能との整合性

**Objective:** 開発者として、enum サポートが追加されても既存の Object/Union 型の抽出が影響を受けないでほしい。これにより、既存のコードベースが正常に動作し続ける。

#### Acceptance Criteria

1. The type-extractor shall Object 型（interface/type alias）の抽出動作を変更しない
2. The type-extractor shall Union 型（オブジェクト型の union）の抽出動作を変更しない
3. When enum 型とObject 型が同じファイルに存在するとき, the type-extractor shall 両方を正しく抽出する
4. The graphql-converter shall 既存の RESERVED_TYPE_NAMES チェックを enum にも適用する
