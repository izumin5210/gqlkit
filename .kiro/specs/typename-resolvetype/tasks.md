# Implementation Plan

## Tasks

- [x] 1. typename 抽出機能の実装
  - Union/Interface メンバーから __typename および $typeName の値を抽出する
  - __typename を $typeName より優先する
  - optional/nullable および非 string literal type のフィールドを無効として扱う
  - Golden file テストで抽出機能を検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 2.1, 2.2, 2.3, 2.4, 2.7_

- [x] 2. (P) typename 重複検証の実装
  - 同一抽象型内での typename 値重複を検出しエラー報告する
  - スキーマ全体での typename 値重複を検出しエラー報告する
  - __typename と $typeName のクロス重複も検出する
  - Task 1 完了後に並列実行可能
  - Golden file テストでエラーケースを検証する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [x] 3. (P) inline オブジェクト必須検証の実装
  - inline オブジェクトを含む Union/Interface ですべてのメンバーに typename を要求する
  - 不足時および型不正時のエラー報告を行う
  - Task 1 完了後に並列実行可能
  - Golden file テストでエラーケースを検証する
  - _Requirements: 1.6, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. resolveType 自動生成の実装
  - 有効な typename を持つ Union/Interface に resolveType を自動生成する
  - __typename のみ、$typeName のみ、混在パターンに対応する
  - inline オブジェクトからオブジェクト型を自動定義する
  - 手動 defineResolveType 定義済みの型はスキップする
  - Task 1, 2, 3 完了後に実行
  - Golden file テストで出力を検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. (P) 既存 inline union payload の $typeName 対応
  - 既存の inline union payload 処理に $typeName サポートを追加する
  - __typename 必須検証で $typeName も認識する
  - 既存動作との完全な互換性を維持する
  - 他タスクと独立して並列実行可能
  - Golden file テストで互換性を確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. パイプラインへの統合
  - 新コンポーネントを auto-type-generator パイプラインに組み込む
  - resolver-collector で自動生成 resolveType を登録する
  - 総合的な Golden file テストで全機能を検証する
  - Task 1-5 完了後に実行
  - _Requirements: 1.1, 1.5, 2.1, 2.5, 5.1_
