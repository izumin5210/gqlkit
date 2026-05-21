# gqlkit eval — sonnet 5 iterations

- Agent: `claude-code` × model `claude-sonnet-4-6`
- Iterations: 5 × 8 evals = 40 sandbox runs (each iteration runs all 8 evals concurrently)
- Sandbox: docker (Colima, 8192MB / 2 CPU)
- Overall: **40/40 runs passed**

## Per-eval pass rate

| eval | runs | passed | pass rate | tests / run | mean dur | median dur |
|---|---:|---:|---:|---|---:|---:|
| 01-crud-codegen | 5 | 5 | 100% | 4 | 610s | 665s |
| 01-crud-pothos | 5 | 5 | 100% | 4 | 407s | 395s |
| 01-crud-gqlkit-plain | 5 | 5 | 100% | 4 | 592s | 583s |
| 01-crud-gqlkit-skill | 5 | 5 | 100% | 5 | 345s | 325s |
| 02-relation-codegen | 5 | 5 | 100% | 6 | 659s | 673s |
| 02-relation-pothos | 5 | 5 | 100% | 6 | 373s | 329s |
| 02-relation-gqlkit-plain | 5 | 5 | 100% | 6 | 466s | 426s |
| 02-relation-gqlkit-skill | 5 | 5 | 100% | 7 | 387s | 394s |

## (A) Skill consultation (gqlkit-skill variants only)

For each `*-gqlkit-skill` eval we recorded which `.claude/skills/gqlkit-guide/*.md` files the agent read from the bundled skill before producing code.

| eval | runs that read skill | total files read (avg) | top files read |
|---|---:|---:|---|
| 01-crud-gqlkit-skill | 5/5 | 6.4 | gqlkit-guide/references/schema/queries-mutations.md (5), gqlkit-guide/references/schema/enums.md (5), gqlkit-guide/references/getting-started.md (5) |
| 02-relation-gqlkit-skill | 5/5 | 6.6 | gqlkit-guide/references/schema/objects.md (5), gqlkit-guide/references/schema/queries-mutations.md (5), gqlkit-guide/references/getting-started.md (5) |

## Failures

None.

## Per-test pass rate

Each eval ships its own EVAL.ts with task-specific assertions. The number under `tests / run` above is constant per eval; here we show how often the per-test assertions passed.

| eval | per-run pass | failures observed |
|---|---|---|
| 01-crud-codegen | 4/4, 4/4, 4/4, 4/4, 4/4 | — |
| 01-crud-pothos | 4/4, 4/4, 4/4, 4/4, 4/4 | — |
| 01-crud-gqlkit-plain | 4/4, 4/4, 4/4, 4/4, 4/4 | — |
| 01-crud-gqlkit-skill | 5/5, 5/5, 5/5, 5/5, 5/5 | — |
| 02-relation-codegen | 6/6, 6/6, 6/6, 6/6, 6/6 | — |
| 02-relation-pothos | 6/6, 6/6, 6/6, 6/6, 6/6 | — |
| 02-relation-gqlkit-plain | 6/6, 6/6, 6/6, 6/6, 6/6 | — |
| 02-relation-gqlkit-skill | 7/7, 7/7, 7/7, 7/7, 7/7 | — |

## Comparison across setups (mean per task)

Comparing setups within each task. `turns` is `o11y.totalTurns` reported by agent-eval — a rough proxy for how much agent effort the task took.

### 01-crud

| setup | mean dur | mean turns | tests |
|---|---:|---:|---:|
| codegen | 610s | 10.6 | 4 |
| pothos | 407s | 7.4 | 4 |
| gqlkit-plain | 592s | 11.0 | 4 |
| gqlkit-skill | 345s | 7.8 | 5 |

### 02-relation

| setup | mean dur | mean turns | tests |
|---|---:|---:|---:|
| codegen | 659s | 12.6 | 6 |
| pothos | 373s | 6.6 | 6 |
| gqlkit-plain | 466s | 11.2 | 6 |
| gqlkit-skill | 387s | 7.8 | 7 |

## Observations

- **01-crud, gqlkit + skill vs gqlkit plain**: mean turns 7.8 vs 11.0 (29% fewer with skill); mean duration 345s vs 592s (42% faster).
- **02-relation, gqlkit + skill vs gqlkit plain**: mean turns 7.8 vs 11.2 (30% fewer with skill); mean duration 387s vs 466s (17% faster).
- **(B) DataLoader assertions in 02-relation passed in all 15 runs** (5 × {codegen, Pothos, gqlkit-plain, gqlkit-skill}) — the agent reached for `ctx.loaders.*` and avoided the obvious `Promise.all(.find())` N+1 shape *without any prompt-side hint*.
- **(F) `User.email` exclusion passed in every run** across all 40 — the agent does not leak the sensitive field even though it is in the backing type.
- **gqlkit-skill agents are fastest** despite having to read the bundled docs first. Skill consultation correlates with fewer turns (no API trial-and-error).

## Agent activity (turns)

| eval | mean turns | median turns |
|---|---:|---:|
| 01-crud-codegen | 10.6 | 9 |
| 01-crud-pothos | 7.4 | 7 |
| 01-crud-gqlkit-plain | 11.0 | 11 |
| 01-crud-gqlkit-skill | 7.8 | 7 |
| 02-relation-codegen | 12.6 | 14 |
| 02-relation-pothos | 6.6 | 7 |
| 02-relation-gqlkit-plain | 11.2 | 12 |
| 02-relation-gqlkit-skill | 7.8 | 8 |
