import { type DocumentNode, print } from "graphql";

/**
 * DocumentNode を SDL 形式の文字列に変換する。
 * graphql パッケージの print() 関数を使用して SDL を生成する。
 */
export function emitSdlContent(documentNode: DocumentNode): string {
  return print(documentNode);
}
