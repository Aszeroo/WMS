import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.user.delete({ where: { username: 'admin' } })
  .then(() => {
    console.log('Admin user deleted');
    return prisma.$disconnect();
  })
  .catch(err => {
    console.error('Error deleting user:', err);
    return prisma.$disconnect();
  });