# sBuild `project/project.json` Live Data Policy

## Status

`project/project.json` is currently production live/user project data.

It may appear as a tracked dirty file in the production worktree after normal editor use. This is not safe to clean up blindly.

## Do not do these without an approved migration plan

* Do not run `git reset --hard` to clear it.
* Do not run `git clean` to clear nearby generated/user files.
* Do not delete it.
* Do not overwrite it with the committed copy.
* Do not commit live user edits just to make the tree clean.
* Do not hide it with `git update-index --skip-worktree` or `--assume-unchanged` unless a separate approved policy explicitly chooses that local-only behavior.

## Safe handling

For normal repo work:

1. Treat `project/project.json` as unrelated live data.
2. Keep it unstaged and uncommitted.
3. Capture a proof backup before risky operations.
4. Use path-limited staging for task files.
5. Report it as expected dirty state in final reports.

## Recommended long-term fix

Move mutable live project data out of the git worktree in a separate production migration phase.

A safer target shape would be:

* tracked example/template data in the repo, such as `project/project.example.json`
* mutable production data outside git, such as `/var/lib/sbuild/project.json` or another explicitly configured data path
* service/runtime config that points sBuild at the mutable data path
* migration proof with backup, rollback, health checks, auth checks, and manual browser QA

That migration should be its own focused phase and should not be mixed with docs, feature work, or broad cleanup.

## Production migration status

As of the live project data migration phase, production is configured with:

* `SBUILD_DATA_ROOT=/var/lib/sbuild`
* project data at `/var/lib/sbuild/project.json`
* images at `/var/lib/sbuild/images`
* backups at `/var/lib/sbuild/backups`

The repo-local `project/project.json` is ignored local/live residue and must not be committed as source data. Use `project/project.example.json` as the tracked seed/example file.
