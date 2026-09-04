import { PrismaClient } from '@prisma/client';
import { verifyPassword, publicUser } from './src/auth';

const prisma = new PrismaClient();

async function testLogin() {
  try {
    // Simulate what the login route does
    const identifier = 'admin';
    const password = 'admin123';

    console.log(`Attempting to login with identifier: ${identifier}, password: ${password}`);

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }]
      }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash
    });

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    console.log(`Password valid: ${validPassword}`);

    // Get safe user
    const safeUser = user ? publicUser(user) : null;
    console.log(`Safe user: ${safeUser ? JSON.stringify(safeUser) : 'null'}`);

    // Check final condition
    const loginShouldFail = !user || !validPassword || !safeUser;
    console.log(`Login should fail: ${loginShouldFail}`);

    if (!loginShouldFail) {
      console.log('Login would succeed!');
    } else {
      console.log('Login would fail with invalid credentials');
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();