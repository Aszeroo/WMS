import { prisma } from './prisma/client';
async function main() {
  try {
    const count = await prisma.user.count();
    console.log('User count:', count);
  } catch (e) {
    console.error('Database connection error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
