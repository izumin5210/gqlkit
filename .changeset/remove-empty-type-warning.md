---
"@gqlkit-ts/cli": patch
---

refactor: remove `EMPTY_TYPE_PROPERTIES` warning for args types with no properties

Args types that resolve to empty objects now silently produce no GraphQL arguments instead of emitting a warning. This simplifies the codebase by removing the `isNoArgsType` helper and `checkEmptyArgsType` validation.
