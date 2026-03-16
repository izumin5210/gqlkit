---
"@gqlkit-ts/cli": patch
---

fix: resolve nullable union type alias (`T | null` where T is a union) as a reference instead of an inline union
