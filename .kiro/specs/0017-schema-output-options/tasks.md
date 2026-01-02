# Implementation Plan

## Tasks

- [x] 1. (P) 出力設定の型定義を追加する
  - スキーマ出力オプション (AST パスと SDL パス) を表す型を定義する
  - パスに null を指定することで出力を抑制できるセマンティクスを型で表現する
  - 設定解決後の型も定義し、undefined がデフォルト値に解決された状態を表す
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. (P) SDL 形式でのスキーマ出力機能を実装する
  - GraphQL DocumentNode を SDL 形式の文字列に変換する機能を実装する
  - graphql パッケージの print 関数を使用して SDL を生成する
  - 型定義、フィールド、引数、ディレクティブ、description を全て含める
  - TSDoc から抽出済みの description が SDL に正しく出力されることを確認する
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. (P) 未使用型の自動削除機能を実装する
  - DocumentNode から未使用の型を削除する機能を実装する
  - @graphql-tools/utils パッケージの pruneSchema を使用する
  - Query、Mutation、Subscription から参照されていない型を削除対象とする
  - カスタムスカラーは pruning 対象外として保持する
  - 削除された型名を結果として返却し、診断情報として利用可能にする
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. 出力設定の検証と解決処理を追加する
  - 設定読み込み時に出力オプションを検証する処理を追加する
  - AST と SDL の出力パスが有効な型 (string, null, undefined) であることを確認する
  - 無効な型が指定された場合はエラー診断を生成する
  - undefined の場合はデフォルト出力パスに解決する
  - Task 1 の型定義に依存
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. スキーマ生成処理に SDL 出力と pruning を統合する
  - スキーマ生成処理で SDL コンテンツも生成するよう拡張する
  - pruning が有効な場合、DocumentNode 生成後に pruning を適用する
  - pruning 後のスキーマを AST と SDL の両形式に適用する
  - Task 2 の SDL 出力機能と Task 3 の pruning 機能に依存
  - _Requirements: 2.2, 5.3_

- [x] 6. 出力制御処理を orchestrator に追加する
  - 出力設定に基づいて AST ファイルの出力を制御する
  - 出力設定に基づいて SDL ファイルの出力を制御する
  - AST パスが null の場合は AST ファイルを出力しない
  - SDL パスが null の場合は SDL ファイルを出力しない
  - 両方が有効な場合は両形式を同時に出力する
  - 既存の AST 出力は従来通り動作することを保証する
  - Task 4 の設定解決と Task 5 のスキーマ生成拡張に依存
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3_

- [x] 7. 統合テストを実装する
  - AST のみ出力するケースをテストする
  - SDL のみ出力するケースをテストする
  - 両形式を同時に出力するケースをテストする
  - 出力パス設定が反映されることをテストする
  - pruning が正しく適用されることをテストする
  - 完全なスキーマでの SDL 出力内容を検証する
  - Task 6 の統合完了に依存
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_
