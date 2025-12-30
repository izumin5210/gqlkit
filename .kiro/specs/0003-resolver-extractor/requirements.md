# Requirements Document

## Introduction

resolver-extractor は、指定されたディレクトリ以下の TypeScript ファイルから resolver の型と値を収集し、GraphQL スキーマに適用可能なフィールド定義を生成するモジュールである。Query/Mutation のルートフィールド定義と、type-extractor が抽出した型に対するフィールド拡張の2種類を生成する。gqlkit の規約駆動設計に従い、命名規則による1:1マッピング（例: `UserResolver` 型 + `userResolver` 値 = `User` 型のリゾルバ）を基本とする。

## Requirements

### Requirement 1: Resolver ファイルスキャン

**Objective:** As a gqlkit ユーザー, I want 指定ディレクトリ以下の TypeScript ファイルを自動的にスキャンしてほしい, so that resolver 定義を手動で登録する必要がなくなる

#### Acceptance Criteria

1. When ディレクトリパスが指定された場合, the resolver-extractor shall そのディレクトリ以下のすべての `.ts` ファイルを再帰的にスキャンする
2. When スキャン対象ディレクトリが存在しない場合, the resolver-extractor shall `DIRECTORY_NOT_FOUND` 診断エラーを返す
3. When スキャン対象ディレクトリにファイルが存在しない場合, the resolver-extractor shall 空の結果を返す（エラーとしない）
4. The resolver-extractor shall `.d.ts` ファイルはスキャン対象から除外する
5. The resolver-extractor shall テストファイル（`.test.ts`, `.spec.ts`）はスキャン対象から除外する

### Requirement 2: Resolver 型の認識

**Objective:** As a gqlkit ユーザー, I want export された resolver 型が自動的に認識されてほしい, so that 明示的なアノテーションなしで resolver を定義できる

#### Acceptance Criteria

1. When TypeScript ファイルで `*Resolver` サフィックスを持つ型が export されている場合, the resolver-extractor shall その型を resolver 型として認識する
2. When `QueryResolver` 型が export されている場合, the resolver-extractor shall これを Query ルートリゾルバとして認識する
3. When `MutationResolver` 型が export されている場合, the resolver-extractor shall これを Mutation ルートリゾルバとして認識する
4. When `{TypeName}Resolver` 型（Query/Mutation 以外）が export されている場合, the resolver-extractor shall これを `{TypeName}` 型のフィールドリゾルバとして認識する
5. The resolver-extractor shall interface と type alias の両方を resolver 型として認識する

### Requirement 3: Resolver 値の認識と型・値のペアリング

**Objective:** As a gqlkit ユーザー, I want resolver 型と対応する実装値が自動的にペアリングされてほしい, so that 型安全な resolver 実装ができる

#### Acceptance Criteria

1. When `{TypeName}Resolver` 型が export されている場合, the resolver-extractor shall 対応する `{typeName}Resolver` 値（camelCase）を探索する
2. When resolver 型に対応する値が同一ファイル内で export されている場合, the resolver-extractor shall 型と値をペアとして登録する
3. If resolver 型に対応する値が見つからない場合, the resolver-extractor shall `MISSING_RESOLVER_VALUE` 診断エラーを返す
4. If resolver 値に対応する型が見つからない場合, the resolver-extractor shall `MISSING_RESOLVER_TYPE` 診断エラーを返す
5. If 型名と値名の命名規則が一致しない場合, the resolver-extractor shall `NAMING_CONVENTION_MISMATCH` 診断エラーを返す

### Requirement 4: Resolver フィールドシグネチャの解析

**Objective:** As a gqlkit ユーザー, I want resolver の関数シグネチャから引数と戻り値の型を自動推論してほしい, so that GraphQL スキーマとの整合性が保証される

#### Acceptance Criteria

1. When resolver 型のプロパティが関数型の場合, the resolver-extractor shall その関数シグネチャを解析する
2. When Query/Mutation resolver のフィールドがシグネチャ `() => ReturnType` の場合, the resolver-extractor shall これを引数なしのルートフィールドとして認識する
3. When Query/Mutation resolver のフィールドがシグネチャ `(args: ArgsType) => ReturnType` の場合, the resolver-extractor shall 第1引数を GraphQL フィールド引数として認識する
4. When 型リゾルバのフィールドがシグネチャ `(parent: ParentType) => ReturnType` の場合, the resolver-extractor shall これを parent 引数を持つフィールドリゾルバとして認識する
5. When 型リゾルバのフィールドがシグネチャ `(parent: ParentType, args: ArgsType) => ReturnType` の場合, the resolver-extractor shall 第2引数を GraphQL フィールド引数として認識する
6. The resolver-extractor shall args 型のプロパティを GraphQL InputValue 定義に変換する
7. The resolver-extractor shall 戻り値の型から nullable/non-null および list/non-list を推論する
8. The resolver-extractor shall `Promise<T>` 型の場合、内部型 `T` を戻り値型として解釈する
9. If resolver フィールドが不正なシグネチャを持つ場合, the resolver-extractor shall `INVALID_RESOLVER_SIGNATURE` 診断エラーを返す

### Requirement 5: Query/Mutation フィールド定義の生成

**Objective:** As a gqlkit ユーザー, I want QueryResolver/MutationResolver から GraphQL の Query/Mutation フィールド定義が生成されてほしい, so that ルートクエリを自動的に公開できる

#### Acceptance Criteria

1. When QueryResolver が認識された場合, the resolver-extractor shall Query 型のフィールド定義リストを生成する
2. When MutationResolver が認識された場合, the resolver-extractor shall Mutation 型のフィールド定義リストを生成する
3. The resolver-extractor shall 各フィールドの戻り値型を GraphQL 型として変換する
4. The resolver-extractor shall フィールド名をそのまま GraphQL フィールド名として使用する
5. When resolver フィールドに args 引数が存在する場合, the resolver-extractor shall GraphQL フィールド定義に引数リストを含める
6. If 戻り値型が GraphQL でサポートされない型の場合, the resolver-extractor shall `UNSUPPORTED_RETURN_TYPE` 診断エラーを返す
7. If args 型のプロパティが GraphQL でサポートされない型の場合, the resolver-extractor shall `UNSUPPORTED_ARG_TYPE` 診断エラーを返す

### Requirement 6: 型フィールド拡張の生成

**Objective:** As a gqlkit ユーザー, I want type-extractor が定義した型に対するフィールド拡張が生成されてほしい, so that 計算フィールドやリレーションを追加できる

#### Acceptance Criteria

1. When `{TypeName}Resolver` が認識された場合, the resolver-extractor shall 対応する GraphQL 型へのフィールド拡張を生成する
2. The resolver-extractor shall フィールドリゾルバの戻り値型を GraphQL 型として変換する
3. When フィールドリゾルバの parent 引数型と対象型が一致する場合, the resolver-extractor shall そのフィールドを対象型の拡張として登録する
4. When フィールドリゾルバに args 引数が存在する場合, the resolver-extractor shall GraphQL フィールド拡張に引数リストを含める
5. If 対象の型が type-extractor の結果に存在しない場合, the resolver-extractor shall `UNKNOWN_TARGET_TYPE` 診断警告を返す（他コンポーネントとの統合時に解決される可能性があるため）
6. If parent 引数の型と resolver 名から推論される型が一致しない場合, the resolver-extractor shall `PARENT_TYPE_MISMATCH` 診断エラーを返す

### Requirement 7: 結果の収集と出力

**Objective:** As a gqlkit 統合者, I want 抽出結果が構造化された形式で出力されてほしい, so that スキーマ生成パイプラインに組み込める

#### Acceptance Criteria

1. The resolver-extractor shall Query フィールド定義、Mutation フィールド定義、型拡張を分離した構造で返す
2. The resolver-extractor shall 各フィールド定義にソースファイル位置情報を含める
3. The resolver-extractor shall すべての診断情報（errors/warnings）を収集して返す
4. When エラーが存在する場合, the resolver-extractor shall 部分的な結果とエラーの両方を返す（fail-fast ではなく最大限の情報を提供）
5. The resolver-extractor shall 結果を type-extractor と同様の形式で返し、後続処理との統合を容易にする

### Requirement 8: GraphQL スカラー型との対応

**Objective:** As a gqlkit ユーザー, I want TypeScript のプリミティブ型が適切な GraphQL スカラー型に変換されてほしい, so that 型変換を手動で行う必要がない

#### Acceptance Criteria

1. The resolver-extractor shall TypeScript `string` 型を GraphQL `String` スカラーに変換する
2. The resolver-extractor shall TypeScript `number` 型を GraphQL `Int` スカラーに変換する（デフォルト）
3. The resolver-extractor shall TypeScript `boolean` 型を GraphQL `Boolean` スカラーに変換する
4. The resolver-extractor shall TypeScript `null` ユニオン（`T | null`）を nullable フィールドとして解釈する
5. The resolver-extractor shall TypeScript 配列型（`T[]` または `Array<T>`）を GraphQL リスト型に変換する
6. When type-extractor で定義された型を参照している場合, the resolver-extractor shall その型名を GraphQL 型参照として使用する

