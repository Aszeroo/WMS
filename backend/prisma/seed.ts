import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth';

const prisma = new PrismaClient();

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before running the seed`);
  return value;
};

const main = async (): Promise<void> => {
  const username = requiredEnvironment('ADMIN_USERNAME');
  const email = requiredEnvironment('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnvironment('ADMIN_PASSWORD');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');

  const [byUsername, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (byUsername && byEmail && byUsername.id !== byEmail.id) {
    throw new Error('ADMIN_USERNAME and ADMIN_EMAIL belong to different users');
  }

  const existing = byUsername ?? byEmail;
  if (existing) {
    console.log(`Admin account already exists; bootstrap skipped: ${existing.username}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { username, email, passwordHash, role: 'admin' } });
  console.log(`Created admin account: ${username}`);
};

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
