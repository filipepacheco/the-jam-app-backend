# Remediation pass 4 — current-schema baseline (#18)

Scope: make an empty disposable PostgreSQL database reproducible from versioned SQL without changing the current Prisma declaration or application behavior. This completes the clean-install slice of #18; new domain constraints and existing-target rollout remain outstanding.

## Changes

- Replaced the incomplete active migration chain with `20260920000000_baseline` and a PostgreSQL migration lock file.
- Archived all ten previous SQL files byte-for-byte, including the eight previously ignored files. The archive manifest records original paths, prior tracking state and SHA-256 checksums.
- Removed the migration ignore rule. The E2E runner now applies migrations, checks migration status and compares the resulting database with the schema declaration before running HTTP tests.
- Added an existing-target transition runbook and corrected foundation notes that overstated accepted registration/nullability and schedule deletion policy.

No staging/production connection or migration was performed. No deployment pipeline was changed. Queue-order uniqueness, the one-IN_PROGRESS partial index, registration identity changes and real conflicting-write verification remain follow-up work.

## Verification

Red: switching the existing playback suite to migration deployment failed on the old chain with PostgreSQL `42P01`, relation `jams` does not exist, before tests could start.

Green: the baseline applied to an empty disposable PostgreSQL 16 database; migration status was current and schema comparison reported no difference. All 29 focused playback HTTP tests passed.

Final run: 54 PostgreSQL HTTP tests, 27 regression tests and 18 safety checks passed (99 total). TypeScript checking passed. ESLint passed with the existing `no-explicit-any` warning in `src/musica/musica.service.ts:18`. Docker containers were removed by the runner. No build was run.

The successful schema comparison covers Prisma-supported schema objects; it does not establish missing historical partial-index or concurrency guarantees. #18 stays open pending the remaining acceptance work and publication.

## Review

Standards: corrected a foundation note that suggested adding future constraints to the baseline; it now requires a new forward migration. No remaining findings.

Spec: no remaining findings. The reviewer checked the policy corrections against the previously accepted decisions.
