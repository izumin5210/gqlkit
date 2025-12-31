# TODO

gqlkit の未実装機能・既知の問題・改善項目を管理するファイル。

## Type System

### Scalar Types

- [ ] **ID 型サポート**: TypeScript の `string` を GraphQL `ID` として扱う仕組み（専用型 or アノテーション）
- [ ] **Float 型サポート**: 現在 `number` は常に `Int` にマッピング。`Float` への明示的な指定方法が必要
- [ ] **カスタムスカラー型**: `Date`, `DateTime`, `JSON` などのカスタムスカラー定義・使用

### Complex Types

- [ ] **GraphQL Interface 型**: TypeScript interface は現在 Object 型にマッピング。GraphQL Interface としての扱いが必要な場合の対応
- [ ] **ジェネリクス型の完全サポート**: 現在は警告を出して reject
- [ ] **Tuple 型**: TypeScript tuple の GraphQL マッピング
- [ ] **TypeScript extends (継承)**: interface/type の継承関係の GraphQL への反映

## Resolver System

### Core Features

- [ ] **Subscription サポート**: `defineSubscription` API の追加
- [ ] **引数のデフォルト値**: GraphQL フィールド引数の default value 指定

### Advanced Features

- [ ] **resolvers ディレクトリでの型定義サポート**: 現在は `src/gql/types` のみ。resolvers 内での型定義も認識する
- [ ] **context / info パラメータの高度な解析**: 使用状況に基づく最適化等

## Schema Features

### Directives

- [ ] **カスタムディレクティブ**: 現在は `@deprecated` のみ対応。ユーザー定義ディレクティブのサポート

### Documentation

- [ ] **フィールドレベルの deprecation**: TSDoc `@deprecated` がフィールドに適用されることの確認・改善

## Developer Experience

### Documentation

- [ ] **README を新 API (defineQuery/defineMutation/defineField) に更新**: 現在は旧オブジェクトスタイル API の例が記載されている

### Configuration

- [ ] **設定ファイルサポート**: 解析対象ディレクトリ・出力ディレクトリの変更を設定ファイルで指定可能にする

### Integrations

- [ ] **Claude Code skills 提供**: gqlkit 用の Claude Code skills を提供

---

_Last updated: 2026-01-01_
