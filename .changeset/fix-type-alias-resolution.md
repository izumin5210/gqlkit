---
"@gqlkit-ts/cli": patch
---

fix: resolve type aliases correctly in resolver return types and arguments

Type aliases used in `defineQuery`, `defineMutation`, and `defineField` type arguments are now correctly resolved. Previously, when a type alias (e.g., `type UserId = string`) was used in resolver return types or arguments, it was incorrectly expanded to its underlying type instead of preserving the alias name.
