# Requirements Document

## Introduction

本機能は、gqlkit の Union 型および Interface 型における `__typename` フィールドおよび `$typeName` プロパティを利用した自動 `resolveType` 関数生成を拡張する。現在 inline union payload にのみ適用されている型解決機能を、一般の Union 型および Interface 型にも適用可能にする。これにより、開発者は明示的な `defineResolveType` 定義なしに、`__typename` または `$typeName` フィールドのみで抽象型の解決を行えるようになる。`$typeName` は protobuf-es との互換性を提供する。

## Requirements

### Requirement 1: Union 型における __typename ベースの resolveType 自動生成

**Objective:** As a gqlkit ユーザー, I want Union 型のすべてのメンバーに `__typename` または `$typeName` フィールドがある場合に resolveType 関数が自動生成されること, so that 明示的な defineResolveType 定義なしで型解決が行える

#### Acceptance Criteria
1. When Union 型のすべてのメンバーが string literal type の `__typename` フィールドを持つ場合, the gqlkit shall その `__typename` の値を利用した resolveType 関数を自動生成する
2. When Union 型のすべてのメンバーが string literal type の `$typeName` フィールドを持つ場合, the gqlkit shall その `$typeName` の値を利用した resolveType 関数を自動生成する
3. When Union 型のメンバーに `__typename` を持つ型と `$typeName` を持つ型が混在する場合, the gqlkit shall 各メンバーの該当フィールドの値を利用した resolveType 関数を自動生成する
4. When Union 型のメンバーが `__typename` と `$typeName` の両方を持つ場合, the gqlkit shall `__typename` の値を優先して使用する
5. When Union 型のメンバーとして参照されるオブジェクト型が未定義の場合, the gqlkit shall `__typename` または `$typeName` の値を名前とするオブジェクト型を定義する
6. When Union 型のメンバーの一部が `__typename` も `$typeName` も持たない場合, the gqlkit shall resolveType 関数を自動生成しない
7. When Union 型のメンバーの `__typename` または `$typeName` フィールドが string literal type ではない場合, the gqlkit shall resolveType 関数を自動生成しない

### Requirement 2: Interface 型における __typename ベースの resolveType 自動生成

**Objective:** As a gqlkit ユーザー, I want Interface 型を実装するすべての型に `__typename` または `$typeName` フィールドがある場合に resolveType 関数が自動生成されること, so that Interface 型でも明示的な defineResolveType 定義なしで型解決が行える

#### Acceptance Criteria
1. When Interface 型を実装するすべての型が string literal type の `__typename` フィールドを持つ場合, the gqlkit shall その `__typename` の値を利用した resolveType 関数を自動生成する
2. When Interface 型を実装するすべての型が string literal type の `$typeName` フィールドを持つ場合, the gqlkit shall その `$typeName` の値を利用した resolveType 関数を自動生成する
3. When Interface 型を実装する型に `__typename` を持つ型と `$typeName` を持つ型が混在する場合, the gqlkit shall 各実装型の該当フィールドの値を利用した resolveType 関数を自動生成する
4. When Interface 型を実装する型が `__typename` と `$typeName` の両方を持つ場合, the gqlkit shall `__typename` の値を優先して使用する
5. When Interface 型を実装する型として参照されるオブジェクト型が未定義の場合, the gqlkit shall `__typename` または `$typeName` の値を名前とするオブジェクト型を定義する
6. When Interface 型を実装する型の一部が `__typename` も `$typeName` も持たない場合, the gqlkit shall resolveType 関数を自動生成しない
7. When Interface 型を実装する型の `__typename` または `$typeName` フィールドが string literal type ではない場合, the gqlkit shall resolveType 関数を自動生成しない

### Requirement 3: Inline オブジェクトを含む場合の必須 __typename 検証

**Objective:** As a gqlkit ユーザー, I want Union/Interface 型に inline オブジェクトが含まれる場合、すべてのメンバーに `__typename` または `$typeName` が必須となること, so that inline オブジェクトの型解決が一貫して行える

#### Acceptance Criteria
1. When Union 型のメンバーに inline オブジェクトが含まれる場合, the gqlkit shall すべてのメンバーに string literal type の `__typename` または `$typeName` フィールドを要求する
2. When Interface 型を実装する型に inline オブジェクトが含まれる場合, the gqlkit shall すべての実装型に string literal type の `__typename` または `$typeName` フィールドを要求する
3. If inline オブジェクトを含む Union 型のメンバーの一部が `__typename` も `$typeName` も持たない場合, then the gqlkit shall エラーを報告する
4. If inline オブジェクトを含む Interface 型の実装型の一部が `__typename` も `$typeName` も持たない場合, then the gqlkit shall エラーを報告する
5. If inline オブジェクトを含む抽象型で `__typename` または `$typeName` フィールドが string literal type ではない場合, then the gqlkit shall エラーを報告する

### Requirement 4: __typename および $typeName の値の重複禁止

**Objective:** As a gqlkit ユーザー, I want スキーマ内で `__typename` および `$typeName` の値が重複している場合にエラーが発生すること, so that 型解決の曖昧さを防止できる

#### Acceptance Criteria

**抽象型内での重複検証:**
1. If 同一の Union 型内で複数のメンバーが同じ `__typename` 値を持つ場合, then the gqlkit shall 生成時にエラーを報告する
2. If 同一の Union 型内で複数のメンバーが同じ `$typeName` 値を持つ場合, then the gqlkit shall 生成時にエラーを報告する
3. If 同一の Union 型内であるメンバーの `__typename` 値と別のメンバーの `$typeName` 値が同じ場合, then the gqlkit shall 生成時にエラーを報告する
4. If 同一の Interface 型を実装する複数の型が同じ `__typename` 値を持つ場合, then the gqlkit shall 生成時にエラーを報告する
5. If 同一の Interface 型を実装する複数の型が同じ `$typeName` 値を持つ場合, then the gqlkit shall 生成時にエラーを報告する
6. If 同一の Interface 型を実装する型のうち、ある型の `__typename` 値と別の型の `$typeName` 値が同じ場合, then the gqlkit shall 生成時にエラーを報告する

**スキーマ全体での重複検証:**
7. If スキーマ内の異なるオブジェクト型定義が同じ `__typename` 値を持つ場合, then the gqlkit shall 生成時にエラーを報告する
8. If スキーマ内の異なるオブジェクト型定義が同じ `$typeName` 値を持つ場合, then the gqlkit shall 生成時にエラーを報告する
9. If スキーマ内のあるオブジェクト型の `__typename` 値と別のオブジェクト型の `$typeName` 値が同じ場合, then the gqlkit shall 生成時にエラーを報告する

### Requirement 5: 既存 inline union payload 動作との互換性維持

**Objective:** As a gqlkit ユーザー, I want 既存の inline union payload の動作が維持されること, so that 既存のコードベースに影響を与えずに新機能を利用できる

#### Acceptance Criteria
1. The gqlkit shall 既存の inline union payload に対する `__typename` 必須検証の動作を維持する
2. The gqlkit shall 既存の inline union payload に対する resolveType 自動生成の動作を維持する
3. The gqlkit shall 既存の inline union payload に対するオブジェクト型の自動定義の動作を維持する
4. The gqlkit shall 既存の inline union payload で `$typeName` も `__typename` と同様に利用可能とする
