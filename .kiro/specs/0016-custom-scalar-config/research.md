# Research & Design Decisions: Custom Scalar Config

## Summary

- **Feature**: `0016-custom-scalar-config`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - jiti は TypeScript 設定ファイル読み込みのデファクトスタンダードとして広く採用されている
  - Vite スタイルの `defineConfig` パターンは型安全な設定 API として実績がある
  - 既存の ScalarRegistry をファクトリパターンで拡張することで、後方互換性を維持しつつカスタムスカラーをサポート可能

## Research Log

### TypeScript 設定ファイルの読み込み方式

- **Context**: `gqlkit.config.ts` をランタイムで読み込む最適な方法を調査
- **Sources Consulted**:
  - [jiti GitHub Repository](https://github.com/unjs/jiti)
  - [ESLint TypeScript Config Loading Issue](https://github.com/eslint/eslint/issues/19357)
  - [tsdown Config Loader Documentation](https://tsdown.dev/options/config-file)
- **Findings**:
  - **jiti**: Unjs プロジェクトのライブラリ。ESM/CJS 互換性、キャッシュ機能、スマートな構文検出を提供
  - **Node.js native**: v22.6.0 以降で TypeScript ファイルの直接読み込みが可能だが、enum や namespace 非対応
  - **tsx/ts-node**: ランタイム変換だが、jiti より重い依存関係
  - **Docusaurus, ESLint, tsdown** などの主要プロジェクトが jiti を採用
- **Implications**:
  - jiti を採用することで、幅広い Node.js バージョンでの互換性を確保
  - 将来的に Node.js native loading への移行も可能（jiti が自動検出）

### defineConfig パターンの実装

- **Context**: 型安全な設定 API の設計パターンを調査
- **Sources Consulted**:
  - [Vite Config Documentation](https://vite.dev/config/)
  - [Vitest Config Documentation](https://vitest.dev/config/)
  - [VitePress Site Config](https://vitepress.dev/reference/site-config)
- **Findings**:
  - `defineConfig` は入力をそのまま返すシンプルな関数だが、TypeScript の型推論を活用
  - 静的オブジェクトと動的関数（async 対応）の両方をサポートするパターンが一般的
  - JSDoc 型ヒントでも動作するが、`defineConfig` の方がユーザー体験が良い
- **Implications**:
  - 最小限の実装で型安全性を提供可能
  - 将来的に動的設定（環境変数に基づく切り替え等）への拡張も容易

### 既存 ScalarRegistry との統合

- **Context**: 標準 branded type とカスタムスカラーの共存方法を検討
- **Sources Consulted**:
  - `packages/cli/src/shared/scalar-registry.ts`（既存実装）
  - `packages/cli/src/shared/branded-detector.ts`（既存実装）
  - `.kiro/specs/0015-branded-scalar-types/design.md`（前回の設計）
- **Findings**:
  - 現在の `STANDARD_SCALAR_MAPPINGS` は静的な Map として定義
  - `getScalarMapping` は型名のみで検索、インポートパスは考慮していない
  - カスタムスカラーはインポートパスも考慮する必要がある（同名の型が異なるパッケージに存在する可能性）
- **Implications**:
  - ファクトリパターン (`createScalarRegistry`) でインスタンスを作成し、カスタムマッピングを注入
  - 検索時は `(typeName, importPath)` のペアで特定
  - 標準 branded type は `@gqlkit-ts/runtime` からのインポートとして特別扱い

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| jiti | Unjs の TypeScript ローダー | 軽量、ESM/CJS 互換、広く採用 | 追加依存関係 | 選択 |
| Node.js native | v22.6.0+ の native TS 読み込み | 依存関係なし | バージョン制限、機能制限 | 将来検討 |
| tsx | TypeScript 実行環境 | 機能豊富 | 重い依存関係 | 不採用 |

## Design Decisions

### Decision: jiti を使用した設定ファイル読み込み

- **Context**: TypeScript 設定ファイルをランタイムで読み込む方法の選定
- **Alternatives Considered**:
  1. jiti — 軽量な TypeScript ローダー
  2. tsx — フル機能の TypeScript 実行環境
  3. Node.js native — v22.6.0+ の組み込み機能
- **Selected Approach**: jiti を使用
- **Rationale**:
  - Docusaurus, ESLint, tsdown など多くのプロジェクトで採用実績
  - 軽量で依存関係が少ない
  - ESM/CJS の相互運用性が高い
  - スマートな構文検出でパフォーマンス最適化
- **Trade-offs**:
  - 追加依存関係が 1 つ増える
  - Node.js v22.6.0+ では native loading が使えるが、互換性のため jiti を使用
- **Follow-up**: Node.js 22+ が主流になった時点で native loading への移行を検討

### Decision: ScalarRegistry のファクトリパターン化

- **Context**: 標準 branded type とカスタムスカラーの統合管理
- **Alternatives Considered**:
  1. グローバル Map を直接拡張
  2. 新規の CustomScalarRegistry を別途作成
  3. ファクトリパターンでインスタンスを作成
- **Selected Approach**: ファクトリパターン (`createScalarRegistry`)
- **Rationale**:
  - テスト時にモックしやすい
  - 設定ごとに異なるレジストリインスタンスを作成可能
  - 既存の静的関数との後方互換性を維持可能
- **Trade-offs**:
  - パイプライン全体でレジストリインスタンスを渡す必要がある
  - わずかなメモリオーバーヘッド
- **Follow-up**: パイプライン関数のシグネチャ変更が必要

### Decision: インポートパスによるスカラー識別

- **Context**: 同名の型が異なるパッケージに存在する場合の対応
- **Alternatives Considered**:
  1. 型名のみで識別（現行の標準 branded type 方式）
  2. 型名 + インポートパスで識別
  3. 型名 + パッケージ名で識別
- **Selected Approach**: 型名 + インポートパスで識別
- **Rationale**:
  - 最も厳密な識別が可能
  - ユーザーが設定で指定したパスを直接使用できる
  - 将来的なスコープ付き型サポートへの拡張が容易
- **Trade-offs**:
  - 相対パスと絶対パスの解決ロジックが必要
  - パスエイリアス（tsconfig paths）への対応は将来課題
- **Follow-up**: tsconfig paths のサポートを検討

## Risks & Mitigations

- **jiti のバージョン互換性** — マイナーバージョンを固定し、CI で定期的にテスト
- **パスエイリアス非対応** — ドキュメントで明記し、絶対パスまたはパッケージパスの使用を推奨
- **パフォーマンス影響** — 設定読み込みは gen コマンド実行時に 1 回のみのため影響は軽微

## References

- [jiti - Runtime TypeScript and ESM support for Node.js](https://github.com/unjs/jiti)
- [Vite Config Documentation](https://vite.dev/config/)
- [ESLint TypeScript Config Discussion](https://github.com/eslint/eslint/issues/19357)
- [tsdown Config Loader Options](https://tsdown.dev/options/config-file)
