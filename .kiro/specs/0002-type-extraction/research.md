# Research & Design Decisions

## Summary

- **Feature**: `type-extraction`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - TypeScript Compiler APIは型抽出に十分な機能を提供し、ts-morphよりパフォーマンスが優れている
  - TypeScriptのnumberはGraphQL Intにマッピング（Float対応は将来拡張）
  - 既存ツール（ts2graphql等）の設計パターンを参考に、純粋な型解析アプローチを採用

## Research Log

### TypeScript Compiler API の使用方法

- **Context**: TypeScript型抽出のための最適なアプローチを調査
- **Sources Consulted**:
  - [Using the Compiler API - TypeScript Wiki](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
  - [ts-morph Documentation](https://ts-morph.com/)
- **Findings**:
  - `ts.createProgram()` でプログラムインスタンスを作成
  - `program.getTypeChecker()` で型情報を取得
  - `ts.forEachChild()` でAST走査
  - `ts.getCombinedModifierFlags()` でexportフラグを確認
  - Symbolと Typeの概念が重要（Symbolは宣言されたエンティティ、Typeは型情報）
- **Implications**: 生のTypeScript Compiler APIを使用し、ts-morphへの依存を避ける

### ts-morph vs TypeScript Compiler API

- **Context**: 型抽出ライブラリの選択
- **Sources Consulted**:
  - [ts-morph Performance](https://ts-morph.com/manipulation/performance)
  - [ts-morph GitHub](https://github.com/dsherret/ts-morph)
- **Findings**:
  - ts-morphはCompiler APIのラッパーで、操作のたびにAST再パースが発生
  - 型抽出（read-only操作）には生のCompiler APIで十分
  - ts-morphは主にコード変換/リファクタリング向けに設計
  - 大規模ファイルでのパフォーマンスは生のAPIが有利
- **Implications**: type-extractionは読み取り専用のため、生のTypeScript Compiler APIを採用

### TypeScript to GraphQL 型マッピング

- **Context**: TypeScript型をGraphQL型に変換する標準的なマッピングルールの調査
- **Sources Consulted**:
  - [TypeGraphQL Scalars](https://typegraphql.com/docs/scalars.html)
  - [NestJS GraphQL Scalars](https://docs.nestjs.com/graphql/scalars)
  - [ts2graphql GitHub](https://github.com/cevek/ts2graphql)
  - [The Guild GraphQL Scalar Guide](https://the-guild.dev/blog/the-complete-graphql-scalar-guide)
- **Findings**:
  - 基本マッピング:
    - `string` → `String`
    - `boolean` → `Boolean`
    - `number` → `Int`（gqlkitではIntをデフォルト採用）
  - コレクション: `T[]` / `Array<T>` → `[T]`
  - Nullable: `T | null` / `T | undefined` / `?` → nullable型
  - オブジェクト型: `interface` / `type` → `ObjectType`
  - Union型: `A | B` → `Union`
  - GraphQL Int は32ビット符号付き整数（2^31制限）
- **Implications**:
  - numberはIntにマッピング（シンプルさ優先）
  - Float対応は将来拡張として別途検討

### ts2graphql のアーキテクチャ参考

- **Context**: 既存ツールの設計パターンを参考
- **Sources Consulted**:
  - [ts2graphql GitHub](https://github.com/cevek/ts2graphql)
- **Findings**:
  - TypeScriptコンパイラでソースファイルをパース
  - interface → GraphQL ObjectType
  - union type → GraphQL Union
  - optional fields（`?`）→ nullable
  - 配列 → List型
  - メソッドシグネチャ → フィールド + 引数
  - JSDocコメント → GraphQL description
- **Implications**: 類似のパターンを採用しつつ、gqlkitの規約に適合させる

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Visitor Pattern | AST走査にVisitorパターンを使用 | 拡張性、懸念の分離 | 複雑な状態管理 | ts.forEachChildで代替可能 |
| Pipeline Architecture | パース→抽出→変換→出力のパイプライン | 各段階の独立性、テスト容易性 | 段階間のデータ受け渡し設計が必要 | gqlkitのコンセプトに適合 |
| Single-pass Processing | 一度のAST走査で全情報を抽出 | パフォーマンス最適 | コードの複雑化 | 初期実装では採用せず |

## Design Decisions

### Decision: TypeScript Compiler API 直接使用

- **Context**: 型抽出のためのライブラリ選択
- **Alternatives Considered**:
  1. ts-morph — 高レベルAPI、操作が容易
  2. 生のTypeScript Compiler API — 低レベル、高パフォーマンス
- **Selected Approach**: 生のTypeScript Compiler APIを使用
- **Rationale**:
  - type-extractionは読み取り専用操作であり、ts-morphの変換機能は不要
  - 依存関係の最小化（TypeScriptは既にdevDependenciesに存在）
  - パフォーマンス優位性
- **Trade-offs**:
  - API学習コストが高い
  - ボイラープレートコードが増加
- **Follow-up**: TypeChecker APIの詳細な使用パターンを実装時に検証

### Decision: number型のデフォルトマッピング

- **Context**: TypeScriptのnumber型をGraphQLのIntまたはFloatにマッピングする方法
- **Alternatives Considered**:
  1. number → Int（整数優先）
  2. number → Float（浮動小数点優先）
  3. JSDocアノテーションで明示指定
- **Selected Approach**: number → Int にマッピング
- **Rationale**:
  - シンプルさ優先：多くのユースケースで整数フィールドが使用される
  - Float対応は将来拡張として別途設計可能
  - 初期実装の複雑さを抑制
- **Trade-offs**:
  - 浮動小数点が必要な場合は現状対応不可
  - 将来的にFloat対応の追加実装が必要
- **Follow-up**: Float対応（JSDocアノテーション、専用型等）を将来検討

### Decision: エラー収集戦略

- **Context**: パースエラーや型エラーの報告方法
- **Alternatives Considered**:
  1. Fail-fast（最初のエラーで中断）
  2. エラー収集（全エラーを収集して一括報告）
  3. 警告とエラーの分離
- **Selected Approach**: エラー収集 + 警告分離
- **Rationale**:
  - 要件5.4で「複数のエラー・警告を収集し、一括で報告」と明記
  - 開発者体験の向上（一度の実行で全問題を把握）
  - 致命的エラーと警告を区別することで、部分的な成功を許容
- **Trade-offs**:
  - エラー状態の管理が複雑化
  - 後続処理でnullチェックが増加
- **Follow-up**: Result型パターンでエラーと成功を型安全に表現

## Risks & Mitigations

- **TypeScript APIの変更リスク** — TypeScript 5.x の安定APIのみを使用、将来のメジャーバージョンアップ時にテストで検証
- **複雑な型表現のサポート漏れ** — 初期実装でサポート範囲を明確にし、未サポート構文は警告として報告
- **パフォーマンス問題** — 大規模プロジェクトでのベンチマークテストを実装後に実施
- **GraphQL組み込み型との競合** — 型名バリデーションで事前検出（要件2.6）

## References

- [TypeScript Compiler API Wiki](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) — 公式Compiler APIドキュメント
- [ts-morph Documentation](https://ts-morph.com/) — Compiler APIラッパーの参考
- [TypeGraphQL Scalars](https://typegraphql.com/docs/scalars.html) — TypeScript-GraphQL型マッピングの業界標準
- [ts2graphql](https://github.com/cevek/ts2graphql) — 類似ツールの実装参考
- [GraphQL Specification - Scalars](https://spec.graphql.org/October2021/#sec-Scalars) — GraphQLスカラー型の仕様
