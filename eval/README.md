# gqlkit-eval

`@vercel/agent-eval` harness that compares AI coding agent output across 4 GraphQL server setups
(`graphql-codegen` server preset, Pothos, gqlkit plain, gqlkit + bundled skill) on 2 tasks
(`01-crud`, `02-relation`). Drives the §9 eval section of the TSKaigi 2026 talk.

## Layout

```
eval/
  evals/<task>-<setup>/    # 8 mini-projects the sandbox runs the agent against
  experiments/sonnet.ts    # claude-code × claude-sonnet-4-6 × runs:5
  shared/
    fixtures/              # source-of-truth backing schema + DataLoader stubs
    skill/                 # snapshot of `pnpm gqlkit docs` output for setup D
    sync-fixtures.ts       # mirrors shared/* into each eval before runs
```

`eval/` itself is a workspace package (`@gqlkit-ts/eval`), but each
`evals/<task>-<setup>/` is treated by agent-eval as an isolated sandbox project:
deps are reinstalled fresh inside each run.

## Setup

```bash
cd eval
pnpm i
cp .env.example .env   # fill in keys per .env.example
pnpm sync              # copies shared fixtures + skill into each eval
pnpm sonnet:dry        # config sanity check, no API calls
pnpm sonnet            # real run, writes results/ tree
```

## Source spec

`../../slides/slides/2026-05-22-tskaigi2026/notes/09-eval-design.md`
