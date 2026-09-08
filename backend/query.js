const { PrismaClient } = require('./node_modules/@prisma/client'); const prisma = new PrismaClient(); prisma.user.findMany().then(console.log).finally(() => prisma.());
