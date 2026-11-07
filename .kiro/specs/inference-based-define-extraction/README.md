# Roadmap: Inference-Based `define*` Extraction

**Status**: Roadmap note, not an active spec. No `requirements.md`/`design.md`/`tasks.md` exist yet — this file only scopes the problem so a future spec (via the normal `kiro:spec-init` workflow) has a starting point. Explicitly out of scope for `.kiro/specs/refactor-plan.md` (Decision D5): that plan keeps and documents the explicit-generics requirement as-is.

## Why

`defineQuery`, `defineMutation`, `defineSubscription`, and `defineField` all require explicit type arguments today, e.g.:

```typescript
export const users = defineQuery<NoArgs, User[]>(() => db.findAllUsers());
```

If the call omits `<NoArgs, User[]>` and relies on TypeScript inferring the types from the resolver function's return value instead, generation fails with `INVALID_DEFINE_CALL` — even though the omitted-generics version type-checks fine in the editor (the resolver's return type is still fully inferred by TypeScript; gqlkit's CLI simply doesn't read it). This is a real authoring-ergonomics cost: users must state each resolver's `Args`/`Result` twice — once implicitly (via the function's parameter/return types) and once explicitly (via the call's type arguments) — and the two can silently drift if only one is updated.

The requirement is intentional today, not an oversight (see `.kiro/specs/refactor-plan.md` §1.2-F and Decision D5): `extractTypeArgumentsFromCall` (`packages/cli/src/resolver-extractor/extractor/define-api-extractor.ts`) reads `node.typeArguments` directly off the call-expression AST, which is simple and doesn't need to run the checker's inference. Changing that is a real engine change, not a small tweak, so it's deliberately deferred.

## What it would take

- Read `Args`/`Result` from the resolver function's own signature via `ts.TypeChecker` (parameter types, return type unwrapped from `Promise`/`AsyncIterable` as appropriate) instead of `node.typeArguments`, when the call has no explicit type arguments.
- Decide the fallback order when both are present (explicit type arguments vs. inferred signature) — likely explicit wins, for backward compatibility and to let users override inference when it guesses wrong.
- Handle the cases syntactic extraction currently sidesteps for free: generic resolver functions, functions assigned before being passed to `define*` (does the checker still narrow correctly at the call site?), and arrow functions with widened parameter types (`(root, args) => ...` where `args` has no annotation — inference would need the call's contextual typing, not just the function's own declared signature).
- Precedent already exists in this codebase for type-level (checker-driven) extraction: `defineResolveType`/`defineIsTypeOf` already read their target type from the resolver's return-type metadata via `checker.getTypeOfSymbol` rather than syntactic type arguments (`detectAbstractResolverFromMetadataType` in `define-api-extractor.ts`) — proof the approach works for this codebase's marker-property design, though `Args`/`Result` inference is a larger surface than a single target-type name.
- Full backward compatibility: existing explicit-generics call sites must keep working byte-identically; this is additive, not a replacement.
- New testdata coverage for every inference case, since none of the ~230 existing golden cases would exercise the inferred path today.

## Explicitly out of scope for now

- Changing the default behavior or removing the explicit-generics requirement.
- Any change to `INVALID_DEFINE_CALL`'s current diagnostic behavior for syntactic-only extraction.

This note exists so the idea isn't lost, not to commit to a timeline.
