# Domain docs

This repo uses a single-context layout: root `CONTEXT.md` and `docs/adr/`.

## Before exploring, read these

- Read `CONTEXT.md` at the repo root.
- Read ADRs in `docs/adr/` that touch the area being explored.
- If a root `CONTEXT-MAP.md` is introduced later, follow its pointers to relevant context files and context-scoped ADRs.

If these files do not exist, proceed silently; do not suggest creating them upfront.
The `domain-modeling` skill creates them lazily when terms or decisions are resolved.

## Use the glossary's vocabulary

Use the domain terms defined in `CONTEXT.md` in issue titles, proposals, hypotheses, and test names.
Avoid synonyms that the glossary explicitly rejects.
If a needed concept is missing, reconsider the term or note the gap for `domain-modeling`.

## Flag ADR conflicts

Surface any conflict with an existing ADR explicitly, naming the ADR and explaining why reconsidering it may be warranted.
Do not silently override recorded decisions.
