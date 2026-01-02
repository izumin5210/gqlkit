# TODO

gqlkit の未実装機能・既知の問題・改善項目を管理するファイル。

## Type System

### Scalar Types

- [x] **ID 型サポート**: `IDString`, `IDNumber` branded types で対応
- [x] **Float 型サポート**: `Float` branded type で対応。`number` は `Float` にマッピング
- [x] **カスタムスカラー型**: `gqlkit.config.ts` の `scalars` 設定で対応

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

- [x] **README を新 API (defineQuery/defineMutation/defineField) に更新**: 完了

### Configuration

- [x] **設定ファイルサポート**: `gqlkit.config.ts` + `defineConfig()` で対応

### Integrations

- [ ] **Claude Code skills 提供**: gqlkit 用の Claude Code skills を提供

---

_Last updated: 2026-01-02_
