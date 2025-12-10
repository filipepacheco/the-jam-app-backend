import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data for RBAC testing...');

  // Clear existing musicians (Step 12: Test data for role-based access control)
  await prisma.musician.deleteMany();
  console.log('Cleared existing musicians');

  // Create test users with different roles for testing
  const testUsers = [
    {
      name: 'John Host',
      email: 'host@example.com',
      phone: '+5511999999001',
      instrument: 'guitarra',
      level: 'ADVANCED',
      supabaseUserId: 'test-host-001', // This would be from Supabase in production
    },
    {
      name: 'Jane Admin',
      email: 'admin@example.com',
      phone: '+5511999999002',
      instrument: 'bateria',
      level: 'PROFESSIONAL',
      supabaseUserId: 'test-admin-001',
    },
    {
      name: 'Bob User',
      email: 'user@example.com',
      phone: '+5511999999003',
      instrument: 'baixo',
      level: 'INTERMEDIATE',
      supabaseUserId: 'test-user-001',
    },
    {
      name: 'Alice User',
      email: 'alice@example.com',
      phone: '+5511999999004',
      instrument: 'teclado',
      level: 'BEGINNER',
      supabaseUserId: 'test-user-002',
    },
    {
      name: 'Charlie User',
      email: 'charlie@example.com',
      phone: '+5511999999005',
      instrument: 'vocal',
      level: 'ADVANCED',
      supabaseUserId: 'test-user-003',
    },
  ];

  for (const user of testUsers) {
    const musician = await prisma.musician.create({
      data: user as any,
    });
    console.log(`✓ Created test musician: ${musician.name} (${musician.email})`);
  }

  console.log('\n✅ Test data seeded successfully!');
  console.log('\nTest Users for RBAC Testing (Step 12):');
  console.log('=====================================');
  testUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Role: ${index === 0 ? 'host' : index === 1 ? 'admin' : 'user'}`);
    console.log('');
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

