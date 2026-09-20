# Schema foundations investigation — #18

Date: 2026-09-20. Repository inspection did not read an environment file or connect to a database. After staging was explicitly selected, a separate Prisma datasource override read `.env.staging` without emitting its value and ran catalog-only queries in a repeatable-read, read-only transaction. No application rows or migration logs were read; no mutations occurred; credentials and connection URLs were not emitted. Staging evidence is captured in [staging-schema-metadata.json](evidence/staging-schema-metadata.json); production remains uninspected.

## Clean-install implementation update

The current-schema baseline is now implemented locally; see [the migration runbook](../../database-migrations.md). The repository evidence below describes the pre-baseline investigation. The ten historical SQL files now live in [legacy-migrations](legacy-migrations/README.md). Existing-target reconciliation, new constraint migrations, and conflicting-write verification remain outstanding.

## Repository evidence

| Source                                                                                                                                                                             | Observed fact                                                                                                                                                                                                           | Consequence                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gitignore:30`                                                                                                                                                                    | `/prisma/migrations/` is ignored as a directory.                                                                                                                                                                        | New migration directories are ignored unless explicitly force-added or the rule is changed. A normal clone cannot reproduce local migration history.              |
| `git ls-files prisma` at `HEAD` (`0ce5cdf`)                                                                                                                                        | Tracks `schema.prisma`, seed files, and only `20260305_add_musician_bio_and_other_instruments/migration.sql` and `20260306_add_jam_music_notes/migration.sql`.                                                          | The tracked chain has no initial migration and cannot create a new database.                                                                                      |
| `rg --files --hidden --no-ignore prisma`                                                                                                                                           | Also finds eight ignored local migration SQL files dated 20260117–20260309.                                                                                                                                             | Local working copy contains non-versioned schema history that a clean checkout does not receive.                                                                  |
| `prisma/schema.prisma:25-234`                                                                                                                                                      | Current application declaration expects playback tables/enums, feedback, slug/short code, soft deletion, playlist URL, musician profile fields, JamMusic notes, Music info, updated timestamps, and relations/indexes.  | The Prisma client can be generated from a desired declaration, but this does not prove any selected database has the corresponding objects.                       |
| `prisma/migrations/20260117223655_add_playback_control_system/migration.sql:20-48`                                                                                                 | Assumes pre-existing `jams` and `escalas`, drops an old named constraint, then adds playback columns/FKs and a partial unique index.                                                                                    | This is an incremental alteration, not a baseline; replay on an empty database fails before it can establish the schema.                                          |
| `prisma/migrations/20260127_add_feedback_model/migration.sql:1-20` and `20260210_backend_improvements/migration.sql:5-9`                                                           | Feedback is created first, then later gains `atualizado_em`, which is declared by the current schema at `schema.prisma:204-219`.                                                                                        | The expected column depends on ignored history.                                                                                                                   |
| `prisma/migrations/20260213_add_slug_and_short_code/migration.sql:1-26`, `20260225_add_spotify_playlist_url/migration.sql:1-2`, and `20260309_add_info_to_music/migration.sql:1-2` | These ignored files provide the visible local source for schema fields at `schema.prisma:31-32`, `:43`, and `:63`.                                                                                                      | Their absence from Git makes a clean checkout unable to reproduce those fields.                                                                                   |
| Git object `7f7a03a` (not an ancestor of `HEAD`)                                                                                                                                   | Contains an alternative two-column migration `20260914_add_jam_playlist_and_music_info`; its SQL repeats the playlist URL and Music info additions.                                                                     | It must not be inserted blindly into a restored chain because the local ignored files already express those additions and selected-target state is unknown.       |
| Staging catalog evidence                                                                                                                                                           | All columns and enum labels declared by the current Prisma schema are present, as are the ordinary Prisma-declared indexes and listed foreign keys.                                                                     | Column-level drift is not currently visible in staging; migration reproducibility and missing constraints remain the material gap.                                |
| Staging migration ledger                                                                                                                                                           | It records only `20260117223655` through `20260210`, including one rolled-back zero-step playback attempt, while catalog columns for later slug/short code, playlist URL, profile, notes, and info changes are present. | Those changes reached staging outside the recorded migration chain, or their history was resolved/removed. The catalog cannot establish which mechanism was used. |
| Staging constraints/indexes                                                                                                                                                        | No unique index/constraint exists on `escalas("jamId", ordem)`, and no partial unique index exists for `status = 'EM_ANDAMENTO'`.                                                                                       | The observed historical protections are absent from staging and require a reviewed forward migration after data preflight.                                        |

The repository has an initial Prisma schema declaration in Git history (`838363a:prisma/schema.prisma`), but no corresponding initial `prisma/migrations/*/migration.sql` was found in the current tree or `origin/main`. It is useful historical context, not a deployable migration baseline.

## Incompatibilities and unresolved drift

1. **Source control versus local SQL.** The ignore rule makes the migration directory disappear from clones while `schema.prisma` remains tracked. This is the primary reproducibility failure.
2. **No empty-database path.** Every visible early migration assumes tables/enums created before it; no committed migration creates the original core tables or enum types.
3. **Accepted schedule-order rule is not enforced.** The ignored playback migration creates `UNIQUE ("jamId", "ordem")` (`20260117223655...:31-32`), but `Schedule` does not declare `@@unique([jamId, order])` (`schema.prisma:118-137`) and staging has no equivalent index.
4. **Duplicate enforcement attempts.** `20260117223655...:48` and `20260122_add_indexes/migration.sql:4-6` create differently named partial unique indexes with the same predicate: at most one `EM_ANDAMENTO` schedule per jam. PostgreSQL permits both indexes, so a target may carry redundant indexes. Neither partial index is represented in the Prisma schema.
5. **Migration idempotence is inconsistent.** Some files use `IF EXISTS`/`IF NOT EXISTS` (`20260210...`), while others use plain `ADD COLUMN`, `CREATE INDEX`, and `ALTER TYPE`. Replaying a partial or already-manually-updated target could fail and leaves no safe automatic recovery.
6. **Historical overlap.** The non-ancestor `7f7a03a` migration combines two already-visible ignored additions. It is evidence of competing histories, not proof that either sequence was ever applied to a selected target.
7. **Migration ledger unknown.** `_prisma_migrations` may name/checksum migrations that are absent from Git, or it may be empty if schema push/manual SQL was used. Only the selected target's catalog can settle this.

## Constraints: current declarations, observed historical SQL, and candidates

The following categories are deliberately separate. “Candidate” is a policy decision, not approval to add a constraint.

| Category                                                                   | Evidence                                                                                                                                                                    | Status                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JamMusic unique pair                                                       | `schema.prisma:20` declares `@@unique([jamId, musicId])`.                                                                                                                   | Current declaration.                                                                                                                                                                                 |
| Registration unique triple                                                 | `schema.prisma:113` declares `@@unique([musicianId, jamId, jamMusicId])`. PostgreSQL unique indexes permit repeated `NULL` values, while `jamMusicId` is nullable (`:105`). | Legacy declaration; superseded for new registrations by the accepted scheduled-slot + instrument identity.                                                                                           |
| Registration identity                                                      | One application per musician + scheduled song slot + instrument; multiple instruments for the same slot are allowed.                                                        | Identity accepted. Non-null/canonical instrument enforcement and legacy cleanup remain proposals; design those before adding unique (`musicoId`, `escalaId`, `instrumento`). Instrument counts are accepted as guidance, not approval limits. |
| Schedule order unique within a jam                                         | Ignored playback SQL adds `UNIQUE ("jamId", "ordem")`; current Prisma declaration omits it and staging lacks it.                                                            | Accepted: explicit reorder renumbers the queue. Add to the schema and a new forward migration after duplicate data preflight; do not edit the baseline.                                                              |
| One in-progress schedule per jam                                           | Two ignored partial unique index definitions use `status = 'EM_ANDAMENTO'`.                                                                                                 | Observed historical SQL; intended rule is strongly suggested, but the index name, one-copy canonical definition, and deployment state remain unverified.                                             |
| Current schedule belongs to the same Jam                                   | `jams.currentScheduleId` references an `escalas` row but no database constraint shown ties that row's `jamId` to the parent Jam.                                            | Candidate invariant; choose application transaction validation or a database design before enforcing.                                                                                                |
| Registration's Jam agrees with linked Schedule/JamMusic                    | The schema holds `jamId`, optional `scheduleId`, and optional `jamMusicId` (`schema.prisma:98-115`) without a cross-row agreement constraint.                               | Accepted identity makes the scheduled slot authoritative for new registrations; migrate redundant legacy identity only after preflight.                                                              |
| Generic schedule boundary                                                  | Accepted policy: generic PATCH cannot transfer a schedule to another Jam or set playback status/current/completed timestamps; current/completed schedules cannot be deleted, and removing registered unplayed slots cancels them while preserving history.                  | Application/API constraint; it informs migration safety but does not itself require a database constraint.                                                                                           |
| Jam ownership and global-host opt-in                                       | Accepted policy: new events are owner-only by default; the owner may opt into all-global-host playback, queue, and approval authority.                                      | Application/API authorization constraint, not a schema change by itself.                                                                                                                             |
| Playback state, current pointer, timestamps, and schedule status coherence | Fields and enums are declared at `schema.prisma:41-42`, `:118-137`, and `:183-201`.                                                                                         | Candidate operational invariant; define transitions before adding a database assertion/trigger.                                                                                                      |
| Feedback rating bounds                                                     | `Feedback.rating` is an unrestricted `Int` in `schema.prisma:204-219`.                                                                                                      | Candidate product validation rule; no accepted range was found here.                                                                                                                                 |

## Proposed reproducible baseline and forward path

This is a staged proposal, not an instruction to mutate a target.

1. **Freeze the intended target definition.** Resolve the candidate policies above, then make `schema.prisma` express every Prisma-supported accepted constraint. Keep database-only restrictions (such as a PostgreSQL partial index) in reviewed SQL with a comment explaining why Prisma cannot represent them.
2. **Restore source control before deployment.** Remove/narrow the migrations ignore rule and commit a single reviewed history. Do not copy both overlapping playlist/info migrations into that history. Preserve the ignored files separately for forensic comparison until the target ledger and catalog establish the canonical order.
3. **Create a fresh-install baseline on a disposable PostgreSQL database.** Generate the core DDL from the frozen schema (for example, `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`), review it, and commit it as the initial migration. Follow it with a dedicated reviewed migration for accepted PostgreSQL-only indexes/constraints. Confirm that a fresh database can use `prisma migrate deploy` without `db push`.
4. **Use a distinct existing-database path.** Staging's catalog is now captured and proves catalog/ledger divergence. Compare that evidence to the proposed baseline before writing a migration. Do not run `migrate resolve` until the target is proven equivalent to the exact baseline/forward migrations being marked applied; resolve records history, it does not create missing objects. Production needs its own separately authorized preflight.
5. **Author a minimal target-specific forward migration.** Address only catalog-confirmed gaps. Preflight data checks must pass before adding unique/FK/check constraints. Use a clone/staging rehearsal first, then deploy through the reviewed chain. Do not use `prisma db push` or `prisma migrate reset` on a deployed target.
6. **Make CI prove repeatability.** A disposable PostgreSQL job should apply `prisma migrate deploy`, run `prisma migrate status`, inspect the required database-only indexes, and execute the database-dependent tests. A schema-only client-generation/build check is insufficient.

## Read-only preflight data checks for a selected target

These templates query application rows and require separate explicit authorization for the selected target. They were not executed in this investigation.

```sql
-- Duplicate schedule positions block UNIQUE ("jamId", "ordem").
SELECT "jamId", "ordem", count(*)
FROM public.escalas
GROUP BY "jamId", "ordem"
HAVING count(*) > 1;

-- Multiple active songs block either observed partial unique index.
SELECT "jamId", count(*)
FROM public.escalas
WHERE status = 'EM_ANDAMENTO'
GROUP BY "jamId"
HAVING count(*) > 1;

-- Nullable JamMusic means the schema-declared unique triple does not reject these duplicates.
SELECT "musicoId", "jamId", count(*)
FROM public.inscricoes
WHERE "jamMusicaId" IS NULL
GROUP BY "musicoId", "jamId"
HAVING count(*) > 1;

-- Cross-Jam inconsistencies must be remediated before any chosen identity constraint.
SELECT r.id, r."jamId", s."jamId" AS schedule_jam_id, jm."jamId" AS jam_music_jam_id
FROM public.inscricoes AS r
LEFT JOIN public.escalas AS s ON s.id = r."escalaId"
LEFT JOIN public.jamsmusics AS jm ON jm.id = r."jamMusicaId"
WHERE (s.id IS NOT NULL AND s."jamId" IS DISTINCT FROM r."jamId")
   OR (jm.id IS NOT NULL AND jm."jamId" IS DISTINCT FROM r."jamId");

-- A current pointer to a schedule from another Jam violates the candidate playback invariant.
SELECT j.id, j."currentScheduleId", s."jamId" AS schedule_jam_id
FROM public.jams AS j
JOIN public.escalas AS s ON s.id = j."currentScheduleId"
WHERE s."jamId" IS DISTINCT FROM j.id;
```

## Rollout and recovery plan

Before any mutation, take a provider-supported point-in-time/snapshot backup and a schema-only logical export, record the migration ledger/catalog fingerprint, and rehearse both the forward change and recovery on a clone. The target owner must supply the RPO/RTO and the target selection; this repository inspection cannot do so.

Deploy an additive, reviewed migration first where possible, backfill in explicit batches, validate the catalog and data checks, then perform any final validation/constraint step. Record `prisma migrate status`, required-index catalog output, and application smoke-test results after deployment. The existing historical files contain non-reversible operations (`DROP COLUMN`, enum addition, and data backfill), so rollback must be treated as a restore or a separately-tested forward repair, never as an assumed Prisma down migration. If a migration fails after a transaction boundary or a manual step, stop writes according to the incident plan, assess the actual catalog state, restore the tested snapshot/clone procedure if needed, and only then repair the migration ledger with a reviewed command.

## Next action

Use the staging evidence to design a reviewed forward migration for the accepted schedule-order restriction and scheduled-slot/instrument registration identity only after its data preflight passes. Instrument counts are guidance; same-musician simultaneous-part approval remains a separate decision; the playback partial-index decision blocks only that protection. Restore a committed clean-install migration history in parallel; do not use staging catalog facts to mark production migrations resolved without a separately authorized production preflight.

## Artifact verification

The reusable catalog SQL executed successfully in read-only transactions on disposable PostgreSQL 16, both without a Prisma ledger and with a synthetic ledger row. The disposable container was removed. JSON evidence parses successfully and Git whitespace checks pass. No application/schema implementation changed, so application tests were not rerun for this documentation-only batch. Staging application-row preflight and migration execution remain outstanding.
