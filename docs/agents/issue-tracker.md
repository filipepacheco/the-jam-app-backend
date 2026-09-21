# Issue tracker: GitHub

Issues and specs live in GitHub Issues for
filipepacheco/the-jam-app-backend. Use the gh CLI from this repo.

## Conventions

- Create: gh issue create --title "..." --body-file <file>
- Read: gh issue view <number> --comments
- List: gh issue list --state open --json number,title,body,labels,comments
- Comment: gh issue comment <number> --body-file <file>
- Label: gh issue edit <number> --add-label "..." or --remove-label "..."
- Close: gh issue close <number> --comment "..."

Write multiline bodies to a temporary file and pass --body-file.
Read docs/agents/triage-labels.md for triage label mappings.

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the issue and its comments.

## Pull requests as a triage surface

PRs as a request surface: no.

GitHub shares numbering between issues and PRs. For an ambiguous reference,
resolve it with gh pr view <number>, falling back to gh issue view <number>.

## Wayfinding operations

- Map: one issue labeled wayfinder:map containing Notes, Decisions-so-far,
  and Fog.
- Children: link tickets as GitHub sub-issues. If unavailable, use a task
  list in the map and a "Part of #<map>" line in each child.
- Types: wayfinder:research, wayfinder:prototype, wayfinder:grilling,
  or wayfinder:task.
- Blocking: use native GitHub issue dependencies. If unavailable, record
  "Blocked by: #<number>" at the top of the child body.
- Frontier: choose the first open, unassigned child in map order whose
  blockers are all closed.
- Claim: gh issue edit <number> --add-assignee @me.
- Resolve: comment with the result, close the child, and add a concise
  result and link to the map's Decisions-so-far.
