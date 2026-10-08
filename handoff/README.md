# Workflow files to move into place

The pushing token cannot write `.github/workflows/**`, so the new and changed
workflow files are parked in `handoff/workflows/`. Everything else (scripts,
docs, `package.json`) is already in its final place. `.github/workflows/`
still holds the unmodified versions of `deploy-edge-reusable.yml` and
`deploy-edge-function.yml`.

From the repo root, on this branch:

```bash
cp handoff/workflows/*.yml .github/workflows/   # overwrites the two edge workflows with the changed versions
git rm -r handoff
git add .github/workflows
git commit -m "ci(supabase): move label-gated deploy workflows into place"
```

Then follow the GitHub setup list in `docs/ENVIRONMENTS.md`
("Database and edge-function deploys").
