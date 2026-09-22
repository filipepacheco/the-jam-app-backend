const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'staging') {
  console.error('Refusing to change the registration default outside the staging preview deployment');
  process.exit(1);
}

async function readDefault() {
  const [column] = await prisma.$queryRawUnsafe(`
    SELECT column_default AS "columnDefault"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jams'
      AND column_name = 'auto_approve_registrations'
  `);

  return column?.columnDefault ?? null;
}

async function main() {
  const before = await readDefault();
  console.log(JSON.stringify({ phase: 'before', autoApproveRegistrationsDefault: before }));

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "jams"
    ALTER COLUMN "auto_approve_registrations" SET DEFAULT true
  `);

  const after = await readDefault();
  console.log(JSON.stringify({ phase: 'after', autoApproveRegistrationsDefault: after }));

  if (after !== 'true') {
    throw new Error('Staging registration default verification failed');
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
