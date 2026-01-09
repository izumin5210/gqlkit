# Requirements Document

## Project Description (Input)
以下のようなルールで nested object, nested input object, arg input object を自動生成する仕様を追加する

```ts
// `User` object type が生成される
export type User = {
  // - `UserProfile` object type が生成される
  // - 名前が衝突した場合はエラーになる
  // - 名前は `{PascalCase<親Type名>}{PascalCase<Arg名>}Input` とする
  profile: {
    // ...
  }
}

// `Input` suffix がある場合、`User` input object type が生成される
export type UserInput = {
  // - `UserProfileInput` input object type が生成される
  // - 名前は `{PascalCase<親Type名>からInput suffix を取り除いたもの}{PascalCase<Arg名>}Input` とする
  // - 名前が衝突した場合はエラーになる
  profile: {
    // ...
  }
}

export updateUser = defineMutation<{
  // - `UpdateUserInput` input object type が生成される
  // - 命名について
  //     - Query, Mutation の場合、`{PascalCase<Field名>}{PascalCase<Arg名>}Input` とする
  //     - Field の場合、`{親Type名}{PascalCase<Field名>}{PascalCase<Arg名>}Input` とする
  // - 名前が衝突した場合はエラーになる
  input: {
  }
}>(
 // ...
)
```

## Introduction

本仕様は、gqlkit における inline anonymous object type（インライン無名オブジェクト型）の自動GraphQL型生成機能を定義する。この機能により、TypeScript の型定義内でインラインで定義されたオブジェクト型を、命名規則に従って自動的に GraphQL の Object type または Input Object type として生成する。

## Requirements

### Requirement 1: Nested Object Type の自動生成

**Objective:** As a 開発者, I want Object type 内のインラインオブジェクト型から自動的に GraphQL Object type を生成する機能, so that 明示的な型定義なしに nested structure を表現できる

#### Acceptance Criteria
1. When Object type のフィールドにインラインオブジェクト型が定義されている場合, the type-extractor shall `{親Type名}{PascalCase<Field名>}` という名前の GraphQL Object type を生成する
2. When インラインオブジェクト型がさらにネストしたインラインオブジェクト型を含む場合, the type-extractor shall 再帰的に同じ命名規則を適用して Object type を生成する
3. When 生成される型名が既存の型名と衝突する場合, the type-extractor shall 名前衝突エラーを報告する

### Requirement 2: Nested Input Object Type の自動生成

**Objective:** As a 開発者, I want Input type 内のインラインオブジェクト型から自動的に GraphQL Input Object type を生成する機能, so that Input Object でも nested structure を簡潔に定義できる

#### Acceptance Criteria
1. When Input type（`*Input` suffix を持つ型）のフィールドにインラインオブジェクト型が定義されている場合, the type-extractor shall `{親Type名から Input suffix を除いた名前}{PascalCase<Field名>}Input` という名前の GraphQL Input Object type を生成する
2. When インラインオブジェクト型がさらにネストしたインラインオブジェクト型を含む場合, the type-extractor shall 再帰的に同じ命名規則を適用して Input Object type を生成する
3. When 生成される型名が既存の型名と衝突する場合, the type-extractor shall 名前衝突エラーを報告する

### Requirement 3: Resolver 引数の Inline Input Object Type の自動生成

**Objective:** As a 開発者, I want Resolver 定義の引数型でインラインオブジェクト型から自動的に GraphQL Input Object type を生成する機能, so that 引数専用の Input type を別途定義する手間を省ける

#### Acceptance Criteria
1. When Query または Mutation resolver の引数にインラインオブジェクト型が定義されている場合, the resolver-extractor shall `{PascalCase<Field名>}{PascalCase<Arg名>}Input` という名前の GraphQL Input Object type を生成する
2. When Field resolver の引数にインラインオブジェクト型が定義されている場合, the resolver-extractor shall `{親Type名}{PascalCase<Field名>}{PascalCase<Arg名>}Input` という名前の GraphQL Input Object type を生成する
3. When インラインオブジェクト型がさらにネストしたインラインオブジェクト型を含む場合, the resolver-extractor shall 再帰的に同じ命名規則を適用して Input Object type を生成する
4. When 生成される型名が既存の型名と衝突する場合, the resolver-extractor shall 名前衝突エラーを報告する

### Requirement 4: 名前衝突の検出とエラー報告

**Objective:** As a 開発者, I want 自動生成された型名が衝突した場合に明確なエラーメッセージを受け取る機能, so that 問題を迅速に特定して解決できる

#### Acceptance Criteria
1. When 自動生成された型名がユーザー定義の型名と衝突する場合, the schema-generator shall 衝突した型名、衝突元の位置（ファイル名・行番号）、および推奨される解決方法を含むエラーメッセージを出力する
2. When 複数の自動生成された型名が互いに衝突する場合, the schema-generator shall すべての衝突箇所を列挙したエラーメッセージを出力する
3. The schema-generator shall 名前衝突が検出された場合にスキーマ生成を中断し、ゼロ以外の終了コードを返す

### Requirement 5: 既存機能との互換性

**Objective:** As a 開発者, I want 自動生成機能が既存の gqlkit 機能と正しく連携する, so that 現行のコードベースを壊さずに新機能を利用できる

#### Acceptance Criteria
1. The type-extractor shall 自動生成された Object type に対して TSDoc コメントからの description 抽出をサポートする
2. The type-extractor shall 自動生成された Input Object type に対して `GqlFieldDef` による defaultValue 指定をサポートする
3. The type-extractor shall 自動生成された型のフィールドに対して nullability および list type の推論を既存のルール通りに適用する
4. The schema-generator shall 自動生成された型を含むスキーマを graphql-tools 互換の形式で出力する
