---
"@gqlkit-ts/cli": minor
---

feat: validate type references in resolver arguments and return types

**BREAKING CHANGE**: resolvers referencing unknown type names now fail generation with UNSUPPORTED_RETURN_TYPE/UNKNOWN_ARGUMENT_TYPE instead of emitting dangling references.
