import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users in database:', users);

    const equipmentTypes = await prisma.equipmentType.findMany();
    console.log('Equipment types:', equipmentTypes);

    const equipmentInstances = await prisma.equipmentInstance.findMany();
    console.log('Equipment instances:', equipmentInstances);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();