import path from "node:path";
import { fileURLToPath } from "node:url";

export {
  buildSections,
  HEADER_LINES,
  loadMeta,
  type Meta,
  type MetaValue,
  type PageInfo,
  type Section,
} from "./docs-parser";

// Built from the module path rather than `new URL(..., import.meta.url)`,
// which webpack would try to bundle as an asset when the docs site imports this.
export const contentDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content",
);
