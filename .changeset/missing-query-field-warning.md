---
"@gqlkit-ts/cli": patch
---

fix: warn when a schema defines mutations or subscriptions but no query fields, instead of silently generating an empty Query root type
