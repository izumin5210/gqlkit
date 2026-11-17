---
"@gqlkit-ts/cli": patch
---

fix: skip resolver arguments whose names are not valid GraphQL identifiers, and exclude `__typename`/`$typeName` arguments, instead of emitting invalid SDL
