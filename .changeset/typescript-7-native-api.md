---
"@gqlkit-ts/cli": minor
---

feat: analyze sources with the TypeScript 7 native API

**BREAKING CHANGE**: `@gqlkit-ts/cli` now requires `typescript` 7.1 or later; TypeScript 5.x and 6.x are no longer supported. Values of enums generated from string literal unions follow TypeScript 7's union ordering, which can differ from declaration order.
