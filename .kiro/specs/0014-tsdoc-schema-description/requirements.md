# Requirements Document

## Introduction

本機能は、TypeScript ソースコード内の TSDoc コメントを GraphQL スキーマの description フィールドに変換する機能を提供する。gqlkit の規約駆動設計に従い、型定義、フィールド、リゾルバに付与された TSDoc コメントを抽出し、生成される GraphQL スキーマ AST に description として反映する。

## Requirements

### Requirement 1: 型定義の description 生成

**Objective:** 開発者として、TypeScript の型定義に付与した TSDoc コメントが GraphQL の型 description として出力されることで、スキーマの自己文書化を実現したい。

#### Acceptance Criteria
1. When `src/gql/types/` 内の型定義に TSDoc コメントが付与されている場合, the Schema Generator shall 対応する GraphQL 型の description フィールドにコメント内容を設定する
2. When 型定義に TSDoc コメントが存在しない場合, the Schema Generator shall description フィールドを省略する
3. When TSDoc コメントが複数行の場合, the Schema Generator shall 改行を保持したまま description に設定する
4. The Schema Generator shall TSDoc の `@description` タグの内容を description として抽出する
5. When `@description` タグがなく本文のみの TSDoc コメントの場合, the Schema Generator shall 本文を description として使用する

### Requirement 2: フィールドの description 生成

**Objective:** 開発者として、TypeScript の型フィールドに付与した TSDoc コメントが GraphQL フィールドの description として出力されることで、API の利用者が各フィールドの意味を理解できるようにしたい。

#### Acceptance Criteria
1. When オブジェクト型のプロパティに TSDoc コメントが付与されている場合, the Schema Generator shall 対応する GraphQL フィールドの description に設定する
2. When インターフェース型のプロパティに TSDoc コメントが付与されている場合, the Schema Generator shall 対応する GraphQL フィールドの description に設定する
3. When フィールドに TSDoc コメントが存在しない場合, the Schema Generator shall そのフィールドの description を省略する
4. The Schema Generator shall TSDoc の本文または `@description` タグの内容をフィールド description として抽出する

### Requirement 3: リゾルバの description 生成

**Objective:** 開発者として、リゾルバ定義に付与した TSDoc コメントが対応する GraphQL フィールド（Query/Mutation/型フィールド）の description として出力されることで、操作の意図を文書化したい。

#### Acceptance Criteria
1. When `defineQuery` でエクスポートされたリゾルバに TSDoc コメントが付与されている場合, the Schema Generator shall Query 型の対応フィールドの description に設定する
2. When `defineMutation` でエクスポートされたリゾルバに TSDoc コメントが付与されている場合, the Schema Generator shall Mutation 型の対応フィールドの description に設定する
3. When `defineField` でエクスポートされたリゾルバに TSDoc コメントが付与されている場合, the Schema Generator shall 親型の対応フィールドの description に設定する
4. When リゾルバに TSDoc コメントが存在しない場合, the Schema Generator shall そのフィールドの description を省略する

### Requirement 4: description の優先順位

**Objective:** 開発者として、型定義とリゾルバの両方に description が存在する場合の挙動が予測可能であることで、意図した文書化結果を得たい。

#### Acceptance Criteria
1. When 型定義のフィールドとリゾルバの両方に TSDoc コメントが存在する場合, the Schema Generator shall リゾルバ側のコメントを優先する
2. When 型定義のフィールドにのみ TSDoc コメントが存在する場合, the Schema Generator shall 型定義のコメントを使用する
3. When リゾルバにのみ TSDoc コメントが存在する場合, the Schema Generator shall リゾルバのコメントを使用する

### Requirement 5: TSDoc 形式のサポート

**Objective:** 開発者として、標準的な TSDoc 記法がサポートされることで、既存の IDE サポートや開発習慣を活かしたい。

#### Acceptance Criteria
1. The Schema Generator shall `/** ... */` 形式の JSDoc/TSDoc コメントを認識する
2. The Schema Generator shall コメント内の先頭・末尾の空白と `*` プレフィックスを適切に除去する
3. When TSDoc コメントに `@deprecated` タグが含まれている場合, the Schema Generator shall GraphQL の `@deprecated` ディレクティブを付与する
4. When `@deprecated` タグに理由が記載されている場合, the Schema Generator shall deprecated ディレクティブの reason 引数に設定する
5. The Schema Generator shall `@param`、`@returns` などの description 以外のタグを無視し、description には含めない
6. The Schema Generator shall `@privateRemarks` タグの内容を description から除外する

### Requirement 6: リゾルバ引数の description 生成

**Objective:** 開発者として、リゾルバの引数に付与した TSDoc コメントが GraphQL フィールド引数の description として出力されることで、API 利用者が各引数の意味を理解できるようにしたい。

#### Acceptance Criteria
1. When リゾルバの Args 型がインライン型リテラルで定義され、プロパティに TSDoc コメントが付与されている場合, the Schema Generator shall 対応する GraphQL 引数の description に設定する
2. When リゾルバの Args 型が別途定義された型（type/interface）を参照し、その型のプロパティに TSDoc コメントが付与されている場合, the Schema Generator shall 対応する GraphQL 引数の description に設定する
3. When 引数に TSDoc コメントが存在しない場合, the Schema Generator shall その引数の description を省略する
4. When インライン型リテラルと参照先の型定義の両方に同一プロパティの TSDoc が存在する場合, the Schema Generator shall インライン型リテラル側を優先する
