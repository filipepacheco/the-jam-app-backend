# Database migrations

`prisma/migrations/20260920000000_baseline/migration.sql` creates the schema declared by `prisma/schema.prisma` at commit `e98a66a`. It replaces the incomplete active migration chain for **empty databases**. The schema declaration and application behavior are unchanged.

## Fresh disposable databases

Run `npm run test:e2e` with Docker running. The runner creates an isolated PostgreSQL 16 database, applies the committed migration chain, checks migration status, compares the resulting schema with the Prisma declaration, runs the HTTP suite, and removes the container. Application database URLs are overridden before any database command.

Migration directories and `migration_lock.toml` are versioned. Add future schema changes as new migrations; do not edit an already deployed baseline. The baseline was generated using the installed Prisma 5.22 CLI with `migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.

The baseline preserves existing declared keys and foreign-key actions, including the legacy nullable registration key. It does not add queue-order uniqueness, the historical one-IN_PROGRESS partial index, or the accepted slot/instrument identity. Those require coordinated application fixes and constraint verification under #7/#10/#11/#14/#18. A successful schema comparison does not verify PostgreSQL-only partial indexes or concurrency behavior.

## Existing staging and production databases

**Do not run this baseline on an existing database or mark it applied automatically.** It creates types and tables that already exist there. Staging's recorded migration names differ from this new chain, and its catalog is not yet proven equivalent in every detail. Production remains uninspected.

Deployment configuration remains unchanged: Vercel generates the client and builds the application; it does not apply these migrations. Introducing automatic migration deployment is blocked until the existing-target transition has been reviewed and rehearsed.

For each separately authorized target:

1. Capture its catalog and ledger, compare exact column types/defaults/nullability, enum values, index definitions and foreign-key actions with the baseline. Do not infer equivalence from matching column names.
2. Author a target-specific forward repair and ledger transition plan. Application-row preflights require separate authorization. Never reset an existing target or delete its migration ledger to make status pass.
3. Take a recoverable backup and rehearse the transition on a clone, including migration-status checks and application smoke tests. Only resolve a migration after proving the exact objects it represents exist.
4. Review and execute the approved release separately. Record recovery steps and evidence before enabling automatic migration deployment.

See [schema foundations](audits/2026-09-20/schema-foundations.md) for staging evidence, unexecuted preflight templates and rollout/recovery requirements. [Archived SQL](audits/2026-09-20/legacy-migrations/README.md) preserves all ten former migration files with checksums; it is excluded from the active chain.
