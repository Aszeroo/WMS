import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.user.findUnique({ where: { username: 'admin' } })
  .then(user => {
    console.log('User found:', user);
    return prisma.$disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    return prisma.$disconnect();
  });