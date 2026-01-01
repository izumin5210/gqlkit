# Requirements Document

## Introduction
gqlkit において GraphQL の ID 型および Int/Float の区別をサポートするための機能を提供する。TypeScript の branded type パターンを活用し、`@gqlkit-ts/runtime` パッケージで標準の branded type（IDString, IDNumber, Int, Float）を提供する。型解析でこれらの branded type を検出した場合、対応する GraphQL scalar type として schema を生成する。将来的なユーザ定義カスタム scalar 対応を見越した拡張可能な設計とする。

## Requirements

### Requirement 1: 標準 Branded Type の提供
**Objective:** As a gqlkit ユーザ, I want @gqlkit-ts/runtime から標準の branded type をインポートして使用できる, so that GraphQL の ID 型や Int/Float を型安全に扱える

#### Acceptance Criteria
1. The @gqlkit-ts/runtime shall IDString 型を export として提供する（GraphQL ID scalar、文字列ベース）
2. The @gqlkit-ts/runtime shall IDNumber 型を export として提供する（GraphQL ID scalar、数値ベース）
3. The @gqlkit-ts/runtime shall Int 型を export として提供する（GraphQL Int scalar）
4. The @gqlkit-ts/runtime shall Float 型を export として提供する（GraphQL Float scalar）
5. The @gqlkit-ts/runtime shall 各 branded type が TypeScript のプリミティブ型と互換性を持ちつつ区別可能な形で実装する

### Requirement 2: Branded Type の型解析
**Objective:** As a gqlkit ユーザ, I want 型定義で branded type を使用するとコード生成時に自動認識される, so that 明示的な設定なしで適切な GraphQL scalar が生成される

#### Acceptance Criteria
1. When type-extractor が型を解析する際, the type-extractor shall branded type のシンボルを @gqlkit-ts/runtime からのインポートとして識別する
2. When 型フィールドが IDString 型を使用している場合, the type-extractor shall 該当フィールドを ID scalar（文字列ベース）としてマークする
3. When 型フィールドが IDNumber 型を使用している場合, the type-extractor shall 該当フィールドを ID scalar（数値ベース）としてマークする
4. When 型フィールドが Int 型を使用している場合, the type-extractor shall 該当フィールドを Int scalar としてマークする
5. When 型フィールドが Float 型を使用している場合, the type-extractor shall 該当フィールドを Float scalar としてマークする
6. When 型フィールドが TypeScript の number 型を使用している場合, the type-extractor shall Float としてマッピングする（整数が必要な場合は Int branded type を明示的に使用する）

### Requirement 3: GraphQL Schema へのマッピング
**Objective:** As a gqlkit ユーザ, I want branded type が適切な GraphQL scalar 型にマッピングされた schema が生成される, so that 生成された schema が GraphQL 仕様に準拠する

#### Acceptance Criteria
1. When schema-generator が IDString または IDNumber としてマークされたフィールドを処理する際, the schema-generator shall GraphQL の ID scalar 型を出力する
2. When schema-generator が Int としてマークされたフィールドを処理する際, the schema-generator shall GraphQL の Int scalar 型を出力する
3. When schema-generator が Float としてマークされたフィールドを処理する際, the schema-generator shall GraphQL の Float scalar 型を出力する
4. The schema-generator shall branded type を使用したフィールドの nullable/non-nullable 属性を正しく保持する
5. The schema-generator shall branded type を使用したフィールドのリスト型属性を正しく保持する

### Requirement 4: リゾルバ引数での Branded Type サポート
**Objective:** As a gqlkit ユーザ, I want リゾルバの引数型でも branded type を使用できる, so that 入力値も型安全に扱える

#### Acceptance Criteria
1. When resolver-extractor がリゾルバ引数を解析する際, the resolver-extractor shall 引数型内の branded type を認識する
2. When Input Object 型のフィールドが branded type を使用している場合, the schema-generator shall 対応する GraphQL scalar 型を出力する
3. When Query/Mutation の直接引数が branded type を使用している場合, the schema-generator shall 対応する GraphQL scalar 型を出力する

### Requirement 5: 拡張可能なアーキテクチャ
**Objective:** As a gqlkit 開発者, I want branded type の認識ロジックが拡張可能な設計になっている, so that 将来カスタム scalar 型を追加できる

#### Acceptance Criteria
1. The type-extractor shall branded type から GraphQL scalar へのマッピング情報を抽象化されたデータ構造として管理する
2. The type-extractor shall 標準の branded type マッピングをデフォルト値として提供しつつ、拡張ポイントを設ける
3. The schema-generator shall scalar type の情報源に依存しない形で scalar type を処理する
4. If 未知の branded type が検出された場合, the type-extractor shall 警告メッセージを出力し、該当フィールドを String 型として処理する

### Requirement 6: エラーハンドリング
**Objective:** As a gqlkit ユーザ, I want branded type 関連のエラーが明確なメッセージで報告される, so that 問題を迅速に特定・修正できる

#### Acceptance Criteria
1. If branded type のインポートが不正な場合, the type-extractor shall インポート元とエラー内容を含むエラーメッセージを出力する
2. If branded type と他の型が矛盾する形で使用されている場合, the type-extractor shall 具体的な矛盾箇所を示すエラーメッセージを出力する
3. The gqlkit CLI shall branded type 関連のエラーをファイル名と行番号付きで報告する
