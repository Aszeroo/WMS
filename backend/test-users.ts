import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.user.findMany()
  .then(users => console.log('Users:', users))
  .finally(() => prisma.$disconnect());