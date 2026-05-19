# Issue Tracker

Issues are tracked in **GitHub Issues** on the `Masta-C/PMtool` repository.

## CLI

Use the `gh` CLI for all issue operations:

```bash
gh issue create --title "..." --body "..." --label "..."
gh issue list --label "needs-triage"
gh issue edit <number> --add-label "..." --remove-label "..."
gh issue close <number>
```

## Conventions

- **Title**: imperative verb phrase, e.g. "Add offline persistence to Firestore client"
- **Body**: problem statement, acceptance criteria, affected roles
- **Labels**: use the triage labels defined in `triage-labels.md` plus feature area labels (e.g. `auth`, `work-orders`, `rbac`, `pwa`)
- **Milestone**: align to the current phase (Phase 1, Phase 2, etc.)
- **Assignee**: set when a developer picks up the issue

## Repo

```
owner: Masta-C
repo:  PMtool
```
