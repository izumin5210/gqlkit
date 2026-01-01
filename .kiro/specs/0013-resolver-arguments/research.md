# Research & Design Decisions

## Summary

- **Feature**: `resolver-arguments`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - Resolver Extractor は既に引数型（`TArgs`）の抽出機能を実装済み
  - Type Extractor は Input Object の概念を持たず、全てを Output 型として扱っている
  - Schema Generator は `input` 型定義の生成機能が未実装

## Research Log

### 既存の引数抽出実装

- **Context**: 引数抽出の既存実装状況を確認
- **Sources Consulted**: `packages/cli/src/resolver-extractor/extractor/define-api-extractor.ts`
- **Findings**:
  - `extractArgsFromType()` 関数で `TArgs` 型パラメータからプロパティを抽出
  - `ArgumentDefinition` インターフェースで `name`, `tsType`, `optional` を保持
  - `NoArgs`（`Record<string, never>`）のケースは検出済み
  - `ExportedInputType` インターフェースも定義済み
- **Implications**: 引数抽出の基盤は完成しており、Input Object 型の識別と検証を追加すれば良い

### 型変換パイプラインの構造

- **Context**: 型情報の変換フローを理解
- **Sources Consulted**:
  - `packages/cli/src/type-extractor/converter/graphql-converter.ts`
  - `packages/cli/src/resolver-extractor/extract-resolvers.ts`
- **Findings**:
  - `convertTsTypeToGraphQL()` は両ファイルで重複実装
  - プリミティブ型マッピング: `string -> String`, `number -> Int`, `boolean -> Boolean`
  - 配列型、参照型、nullable の変換ロジックが確立済み
- **Implications**:
  - 共通の変換ロジックを抽出してリファクタリングする機会
  - Input Object 判定ロジックは `graphql-converter.ts` に追加するのが適切

### Schema Generator の構造

- **Context**: スキーマ生成の拡張ポイントを特定
- **Sources Consulted**:
  - `packages/cli/src/schema-generator/builder/ast-builder.ts`
  - `packages/cli/src/schema-generator/integrator/result-integrator.ts`
- **Findings**:
  - `buildInputValueDefinitionNode()` は既に実装済み（引数定義用）
  - `buildObjectTypeDefinitionNode()` は `Kind.OBJECT_TYPE_DEFINITION` を使用
  - `IntegratedResult` は `baseTypes` と `typeExtensions` を保持
  - graphql-js の `Kind.INPUT_OBJECT_TYPE_DEFINITION` を使用すれば Input 型定義を生成可能
- **Implications**:
  - `buildInputObjectTypeDefinitionNode()` の新規追加が必要
  - `IntegratedResult` に `inputTypes` フィールドを追加
  - `buildDocumentNode()` で Input 型定義を出力に含める

### GraphQL 仕様の確認

- **Context**: GraphQL における Input Object の制約を確認
- **Sources Consulted**: GraphQL Specification
- **Findings**:
  - Input Object は他の Input Object、Scalar、Enum のみを参照可能
  - Output 型（Object、Interface、Union）への参照は不可
  - 循環参照は許可されるが、少なくとも1つのパスで nullable でなければならない
- **Implications**:
  - Output 型参照の検証が必須
  - 循環参照は警告レベルで対応（nullable でない場合のみエラー）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存拡張 | Type Extractor と Schema Generator を拡張 | 最小限の変更、既存パターン維持 | なし | 採用 |
| 新規パイプライン | Input 専用の抽出・生成パイプライン | 分離が明確 | コード重複、複雑化 | 不採用 |

## Design Decisions

### Decision: Input Object の命名規則

- **Context**: Input Object 型をどのように識別するか
- **Alternatives Considered**:
  1. `*Input` サフィックスによる命名規則
  2. 明示的なアノテーション（例: `@input` デコレータ）
  3. 使用箇所からの推論（引数として使われたら Input）
- **Selected Approach**: `*Input` サフィックスによる命名規則
- **Rationale**:
  - gqlkit の「convention over configuration」原則に適合
  - デコレータ不使用の方針を維持
  - 明示的で予測可能な動作
- **Trade-offs**:
  - 命名規則に従わない既存型は手動でリネームが必要
  - 命名規則を意図せず満たす型が誤認される可能性
- **Follow-up**: 誤認識を防ぐため、Input 命名かつ非オブジェクト型の場合はエラーとする

### Decision: GraphQLTypeKind の拡張

- **Context**: Input Object 型を型システムでどう表現するか
- **Alternatives Considered**:
  1. `GraphQLTypeKind` に `"InputObject"` を追加
  2. `GraphQLTypeInfo` に `isInput: boolean` フラグを追加
  3. 別の型 `GraphQLInputTypeInfo` を定義
- **Selected Approach**: `GraphQLTypeKind` に `"InputObject"` を追加
- **Rationale**:
  - GraphQL 仕様では Input Object は別のタイプとして定義される
  - 型レベルで区別することで誤用を防止
  - パターンマッチングによる分岐処理が容易
- **Trade-offs**:
  - 既存の `"Object"` とのハンドリングが必要
  - 後方互換性への影響（マイナーバージョン変更が必要）
- **Follow-up**: テストで全ての kind パターンをカバー

### Decision: エラー収集戦略

- **Context**: 複数のエラーをどのように報告するか
- **Alternatives Considered**:
  1. 最初のエラーで停止（fail-fast）
  2. 全エラーを収集してまとめて報告
  3. カテゴリごとに分けて報告
- **Selected Approach**: 全エラーを収集してまとめて報告
- **Rationale**:
  - 開発者が一度の実行で全ての問題を把握可能
  - 既存の `Diagnostics` パターンに準拠
  - ビルドツールとしての UX 向上
- **Trade-offs**:
  - 一部のエラーが他のエラーの結果である可能性（カスケード）
  - メモリ使用量の増加（通常は無視できるレベル）
- **Follow-up**: 重複エラーの排除ロジックは既存の `deduplicateDiagnostics()` を活用

## Risks & Mitigations

- **既存型の意図しない Input 認識**: `*Input` 命名の既存型が意図せず Input として扱われる可能性
  - Mitigation: 明確なドキュメントとエラーメッセージ、オプトアウト機構の検討（将来）
- **循環参照のパフォーマンス**: 深くネストした Input Object での循環参照検出
  - Mitigation: 訪問済みノードの追跡、最大深度制限の検討
- **後方互換性**: `GraphQLTypeKind` の変更による既存コードへの影響
  - Mitigation: マイナーバージョンでのリリース、CHANGELOG での明記

## References

- [GraphQL Specification - Input Objects](https://spec.graphql.org/October2021/#sec-Input-Objects)
- 既存実装: `packages/cli/src/resolver-extractor/extractor/define-api-extractor.ts`
- 既存実装: `packages/cli/src/schema-generator/builder/ast-builder.ts`
