---
"@gqlkit-ts/cli": minor
---

feat: prune types unreachable from root operation types by default

**BREAKING CHANGE**: generated schema/typeDefs now omit types not reachable from Query/Mutation/Subscription. Set `output.pruning: false` in gqlkit.config.ts to keep the previous output.
