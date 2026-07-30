---
"@gqlkit-ts/runtime": minor
---

refactor: remove the unused inner marker from GqlInterfaceMetaShape

**BREAKING CHANGE**: the never-functional `" $gqlkitInterface"` property was removed from `GqlInterfaceMetaShape`; code that referenced it structurally (unlikely) must drop it.
