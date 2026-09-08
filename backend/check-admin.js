require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (admin) {
    console.log('Admin user found:');
    console.log(`  ID: ${admin.id}`);
    console.log(`  Username: ${admin.username}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Password hash (first 20 chars): ${admin.passwordHash.substring(0, 20)}...`);
  } else {
    console.log('Admin user NOT found');
  }

  await prisma.$disconnect();
}

main().catch(console.error);