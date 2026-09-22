const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'staging') {
  console.error('Refusing to apply staging DDL outside the staging preview deployment');
  process.exit(1);
}

async function inspect() {
  const [column] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'jams'
        AND column_name = 'auto_approve_registrations'
    ) AS "autoApproveColumnExists"
  `);
  const [constraint] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint constraint_info
      JOIN pg_class table_info ON table_info.oid = constraint_info.conrelid
      JOIN pg_namespace schema_info ON schema_info.oid = table_info.relnamespace
      WHERE schema_info.nspname = 'public'
        AND table_info.relname = 'musicos'
        AND constraint_info.conname = 'musicos_telefone_key'
    ) AS "phoneUniqueConstraintExists"
  `);

  return {...column, ...constraint};
}

async function main() {
  const before = await inspect();
  console.log(JSON.stringify({phase: 'before', ...before}));

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`
      ALTER TABLE "jams"
      ADD COLUMN IF NOT EXISTS "auto_approve_registrations" BOOLEAN NOT NULL DEFAULT false
    `),
    prisma.$executeRawUnsafe(`
      ALTER TABLE "musicos"
      DROP CONSTRAINT IF EXISTS "musicos_telefone_key"
    `),
  ]);

  const after = await inspect();
  console.log(JSON.stringify({phase: 'after', ...after}));

  if (!after.autoApproveColumnExists || after.phoneUniqueConstraintExists) {
    throw new Error('Approved staging DDL verification failed');
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
