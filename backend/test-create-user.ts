import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connection successful');

    // Try to create a user with a dummy password hash
    console.log('Attempting to create user...');
    const user = await prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'dummy_hash_123',
        role: 'viewer'
      }
    });
    console.log('User created successfully:', user);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();