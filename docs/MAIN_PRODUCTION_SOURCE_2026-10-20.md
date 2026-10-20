# Main source and manual deployment

`main` is the default branch and contains the production source verified on 20 October 2026. Its application baseline is commit `7e4773645f3affb16010a5aac3b875a081c69b36`, including the final operational read fix. Repository synchronization changes only workflow safety, local artifact exclusions, their tests and this record; application code and Wrangler bindings remain identical to that baseline.

Verified deployment references, not instructions to redeploy:

| Environment | Worker | Deployment | Version |
| --- | --- | --- | --- |
| Production | `eskahade` | `b93ee1fa-1178-4c84-917a-43ba6e5627fc` | `800e613a-f468-4c46-afa8-bb322f5caf62` |
| Sandbox | `eskahade-sandbox` | `10fe2442-78b1-463a-8da1-27121f9b0e05` | `455392e7-0067-4bd8-ad4f-9d089bf2fb01` |

Both GitHub deployment workflows accept **only `workflow_dispatch`** on `main`. A dispatch must confirm the exact Worker name. The guard validates the account, environment, D1 target, service reference, private storage separation, closed previews and disabled bank network flags. Deployment targets an explicit environment, preserves unrelated vars and disables automatic provisioning. Neither workflow applies migrations. Pushes, pull requests, schedules and completion of other workflows cannot trigger these deployments.

The workflows remain administratively disabled during repository synchronization. A future deployment needs a separately authorized manual operation; do not enable or dispatch it merely to verify this Git change. Future releases must still satisfy the backup, schema, maintenance and financial conservation gates in the release runbooks.

Production permanently has only `DB` pointing to `eskahade-db`; never restore `DEMO_DB`. Sandbox `DB` and `DEMO_DB` point only to `eskahade-demo-db`. BRI/QLola remain OFF. Historical sandbox payment discrepancies remain quarantined.

Private backups, tokens, databases, raw logs and generated recovery packages stay outside version control. Existing tracked user manuals remain historical repository content; new files under `output/` and Python caches are ignored. Local legacy maintenance notes and tool variants are preserved in ignored local evidence rather than replacing the released source.

Validation for this repository-only change:

```sh
node scripts/validate-manual-deploy.cjs production
node scripts/validate-manual-deploy.cjs sandbox
node scripts/test-manual-deploy.cjs
node scripts/test-environment-isolation.cjs
node scripts/test-operasional-read-cache.cjs
```

No Cloudflare deployment, binding update, migration, bank request, secret change or database write is part of this synchronization.
