import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    // Get the admin user from database
    const user = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!user) {
      console.log('Admin user not found');
      return;
    }

    console.log('User from database:');
    console.log(JSON.stringify(user, null, 2));
    console.log(`Password hash in DB: ${user.passwordHash}`);

    // Generate hash for "admin123" using the same method as hashPassword
    const password = 'admin123';
    const generatedHash = await bcrypt.hash(password, 12);
    console.log(`\nGenerated hash for '${password}': ${generatedHash}`);

    // Compare using bcrypt.compare
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log(`\nBcrypt.compare result: ${isMatch}`);

    // Also verify using the verifyPassword function from auth.ts
    const { verifyPassword } = await import('./src/auth');
    const verifyResult = await verifyPassword(password, user.passwordHash);
    console.log(`verifyPassword result: ${verifyResult}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();