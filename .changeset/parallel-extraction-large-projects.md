---
"@gqlkit-ts/cli": patch
---

perf: generate large schemas faster

Projects with enough source extract types and resolvers in parallel ranges of files, on worker threads with their own `tsc` process each (up to four, depending on the available cores). Generated output is the same as before.
