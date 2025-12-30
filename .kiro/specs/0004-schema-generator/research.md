# Research & Design Decisions

## Summary
- **Feature**: `schema-generator`
- **Discovery Scope**: Extension
- **Key Findings**:
  - graphql-js の DocumentNode AST を直接構築し、buildASTSchema 経由でスキーマ生成が可能
  - graphql-tools の resolver map は `{ TypeName: { fieldName: resolverFn } }` 形式
  - 既存の type-extractor/resolver-extractor のパイプラインパターンを踏襲可能

## Research Log

### graphql-js DocumentNode AST 構造
- **Context**: GraphQL スキーマ AST の生成方法を調査
- **Sources Consulted**:
  - [graphql-js AST source](https://github.com/graphql/graphql-js/blob/main/src/language/ast.ts)
  - [GraphQL Utilities documentation](https://graphql.org/graphql-js/utilities/)
- **Findings**:
  - `DocumentNode` は `definitions: ReadonlyArray<DefinitionNode>` を持つ
  - `ObjectTypeDefinitionNode`: `{ kind: 'ObjectTypeDefinition', name: NameNode, fields: FieldDefinitionNode[] }`
  - `FieldDefinitionNode`: `{ kind: 'FieldDefinition', name: NameNode, type: TypeNode, arguments: InputValueDefinitionNode[] }`
  - `UnionTypeDefinitionNode`: `{ kind: 'UnionTypeDefinition', name: NameNode, types: NamedTypeNode[] }`
  - 型ラッピング: `NonNullTypeNode` で non-null、`ListTypeNode` でリスト
  - `Kind` enum から各ノードの kind 値を取得
- **Implications**:
  - graphql-js の Kind 定数をインポートして AST ノードを構築
  - 既存の `GraphQLFieldType` から `TypeNode` への変換ロジックが必要
  - `buildASTSchema` は使用せず、DocumentNode を直接エクスポート（graphql-tools 互換）

### graphql-tools makeExecutableSchema Resolver Format
- **Context**: 生成する resolver map の形式を調査
- **Sources Consulted**:
  - [Apollo GraphQL Tools API](https://www.apollographql.com/docs/apollo-server/v2/api/graphql-tools)
  - [GraphQL Tools Resolvers](https://the-guild.dev/graphql/tools/docs/resolvers)
- **Findings**:
  - resolver map 形式: `{ Query: { field: fn }, Mutation: { field: fn }, TypeName: { field: fn } }`
  - resolver 関数シグネチャ: `(parent, args, context, info) => result`
  - `makeExecutableSchema({ typeDefs, resolvers })` で統合
  - gqlkit では resolver 実装への参照を保持し、再エクスポートする形式を採用
- **Implications**:
  - コード生成時に各 resolver ファイルからの import 文を生成
  - resolver 関数への参照を維持した map オブジェクトを構築

### 既存 Extractor との統合
- **Context**: type-extractor/resolver-extractor の出力形式を確認
- **Sources Consulted**: 既存コードベース分析
- **Findings**:
  - `ExtractTypesResult`: `{ types: GraphQLTypeInfo[], diagnostics: Diagnostics }`
  - `ExtractResolversResult`: `{ queryFields, mutationFields, typeExtensions, diagnostics }`
  - `GraphQLTypeInfo`: `{ name, kind, fields?, unionMembers?, sourceFile }`
  - `TypeExtension`: `{ targetTypeName, fields: GraphQLFieldDefinition[] }`
  - 両方とも `Diagnostics` 型（errors/warnings）を使用
- **Implications**:
  - 両 extractor の結果をマージする統合レイヤーが必要
  - typeExtension の targetTypeName と GraphQLTypeInfo の name でマッチング
  - 診断情報は伝播・集約する

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Pipeline | 既存 extractor と同様のステージ分離 | 一貫性、テスト容易性、責務分離 | ステージ間のデータ受け渡しが複雑になりうる | 採用 |
| Monolithic | 単一関数で全処理 | シンプル、依存関係なし | テスト困難、拡張性低 | 不採用 |

## Design Decisions

### Decision: AST 直接構築 vs SDL 文字列生成
- **Context**: GraphQL スキーマの出力形式選定
- **Alternatives Considered**:
  1. SDL 文字列生成 → `parse()` で AST 化
  2. AST ノードを直接構築
- **Selected Approach**: AST ノード直接構築
- **Rationale**:
  - SDL 文字列生成は文字列操作でエラーが起きやすい
  - AST 直接構築は型安全で、graphql-js の型定義を活用可能
  - parse ステップが不要でパフォーマンス向上
- **Trade-offs**: AST 構築コードが冗長になるが、ビルダー関数で抽象化可能
- **Follow-up**: ビルダー関数の単体テストを充実させる

### Decision: Resolver Map のコード生成戦略
- **Context**: resolver 実装への参照を維持したコード生成方法
- **Alternatives Considered**:
  1. resolver 関数をインライン展開（コピー）
  2. import 文生成 + 参照維持
- **Selected Approach**: import 文生成 + 参照維持
- **Rationale**:
  - 実装コードのコピーは二重管理になり危険
  - 参照維持により元ファイルの変更が即座に反映
  - TypeScript の型推論が維持される
- **Trade-offs**: 相対 import パス解決の複雑さ
- **Follow-up**: パス解決ロジックのエッジケーステスト

### Decision: 型拡張のマージ戦略
- **Context**: type-extractor の型と resolver-extractor の typeExtension の統合方法
- **Alternatives Considered**:
  1. 完全マージ（拡張フィールドをベース型に統合）
  2. 別々に出力（ObjectTypeDefinition + ObjectTypeExtension）
- **Selected Approach**: 完全マージ
- **Rationale**:
  - GraphQL SDL では extension は別定義だが、実行時には統合される
  - 最終出力をシンプルにし、デバッグを容易に
  - resolver-extractor は既存フィールドと競合時にリゾルバ側を優先
- **Trade-offs**: 元の定義がどこから来たか追跡しづらくなる（ソースマップで対応可能）
- **Follow-up**: フィールド競合時の警告診断を実装

## Risks & Mitigations
- graphql-js バージョン更新による AST 構造変更 → 型定義からの自動検出、CI での互換性テスト
- 循環参照型の取り扱い → 既存 extractor で検出済み、そのまま伝播
- 大規模スキーマでのパフォーマンス → ソート処理の最適化、ベンチマークテスト追加

## References
- [graphql-js AST source](https://github.com/graphql/graphql-js/blob/main/src/language/ast.ts) - AST ノード型定義
- [GraphQL Utilities](https://graphql.org/graphql-js/utilities/) - buildASTSchema 等のユーティリティ
- [GraphQL Tools Resolvers](https://the-guild.dev/graphql/tools/docs/resolvers) - resolver map 形式
- [Apollo GraphQL Tools API](https://www.apollographql.com/docs/apollo-server/v2/api/graphql-tools) - makeExecutableSchema API
