# Domain docs

## Layout and reading rules

This repo uses a single-context layout:

- CONTEXT.md at the repository root: domain vocabulary and model.
- docs/adr/: numbered architecture decision records.

Before exploring the domain, read CONTEXT.md and ADRs relevant to the work.

If these files are absent, proceed silently. The domain-modeling skill
creates them lazily as terminology and decisions are resolved.

## Vocabulary

Use the glossary's terms in issues, proposals, hypotheses, and tests.
If a needed concept is missing, reconsider the term or note the gap
for domain-modeling.

## Decision conflicts

Explicitly identify any proposal that contradicts an existing ADR,
including the ADR reference and why the decision merits reconsideration.
