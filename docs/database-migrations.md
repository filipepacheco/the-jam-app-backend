# Database migrations

`prisma/migrations/20260920000000_baseline/migration.sql` creates the schema declared by `prisma/schema.prisma` at commit `e98a66a`. It replaces the incomplete active migration chain for **empty databases**. The schema declaration and application behavior are unchanged.

## Fresh disposable databases

Run `npm run test:e2e` with Docker running. The runner creates an isolated PostgreSQL 16 database, applies the committed migration chain, checks migration status, compares the resulting schema with the Prisma declaration, runs the HTTP suite, and removes the container. Application database URLs are overridden before any database command.

Migration directories and `migration_lock.toml` are versioned. Add future schema changes as new migrations; do not edit an already deployed baseline. The baseline was generated using the installed Prisma 5.22 CLI with `migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.

The baseline preserves existing declared keys and foreign-key actions, including the legacy nullable registration key. The subsequent `20260920010000_add_unique_schedule_queue_order` migration adds unique queue positions alongside serialized allocation/reorder code (#7/#10). The historical one-IN_PROGRESS partial index and accepted slot/instrument identity remain outstanding under #11/#14/#18. Existing targets must pass duplicate-position data preflight before the new unique index is applied. A successful schema comparison does not verify PostgreSQL-only partial indexes or concurrency behavior.

## Existing staging and production databases

**Do not run this baseline on an existing database or mark it applied automatically.** It creates types and tables that already exist there. Staging's recorded migration names differ from this new chain, and its catalog is not yet proven equivalent in every detail. Production remains uninspected.

Deployment configuration remains unchanged: Vercel generates the client and builds the application; it does not apply these migrations. Introducing automatic migration deployment is blocked until the existing-target transition has been reviewed and rehearsed.

For each separately authorized target:

1. Capture its catalog and ledger, compare exact column types/defaults/nullability, enum values, index definitions and foreign-key actions with the baseline. Do not infer equivalence from matching column names.
2. Author a target-specific forward repair and ledger transition plan. Application-row preflights require separate authorization. Never reset an existing target or delete its migration ledger to make status pass.
3. Take a recoverable backup and rehearse the transition on a clone, including migration-status checks and application smoke tests. Only resolve a migration after proving the exact objects it represents exist.
4. Review and execute the approved release separately. Record recovery steps and evidence before enabling automatic migration deployment.

## Existing-target constraint preflight

Before applying migrations after the baseline to staging or production, run the read-only aggregate checks in `scripts/preflight-existing-migrations.sql` with a read-only database role:

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/preflight-existing-migrations.sql
```

Every reported violation count must be zero. A nonzero result is a release stop: do not run `prisma migrate deploy`, and do not bypass the unique index with `IF NOT EXISTS`. Export the affected aggregate keys for review, prepare a separate reversible data-reconciliation migration, and rerun the preflight. Queue positions may be renumbered only under the accepted queue-order policy; registration rows and catalog songs must be merged only after their retained history and references are explicitly reviewed; multiple active schedules require choosing the event's authoritative current schedule. No automatic deletion is authorized.

The authorized staging aggregate preflight on 2026-09-20 reported zero queue-position, registration-identity and multiple-active-schedule groups, plus one duplicate Spotify-link group. Staging rollout is therefore blocked. The aggregate evidence contains no row values; identifying and reconciling the affected catalog rows requires a separately reviewed data-repair step before rerunning this preflight.

After a zero preflight, take a recovery snapshot, apply the migrations, run `prisma migrate status`, and verify the expected indexes through `pg_indexes`. The application rollout remains separate from migration authorization.

See [schema foundations](audits/2026-09-20/schema-foundations.md) for staging evidence, unexecuted preflight templates and rollout/recovery requirements. [Archived SQL](audits/2026-09-20/legacy-migrations/README.md) preserves all ten former migration files with checksums; it is excluded from the active chain.
