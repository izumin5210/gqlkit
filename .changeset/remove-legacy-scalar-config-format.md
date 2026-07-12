---
"@gqlkit-ts/cli": minor
---

feat: remove legacy scalar mapping config format

**BREAKING CHANGE**: the undocumented `{ graphqlName, type }` scalar mapping shape is no longer accepted; use `{ name, tsType }` (see configuration docs). The validator now explains the migration inline.
