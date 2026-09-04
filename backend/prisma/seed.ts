import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/auth';

const prisma = new PrismaClient();

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before running the seed`);
  return value;
};

const main = async (): Promise<void> => {
  console.log('Starting seed script...');

  const username = requiredEnvironment('ADMIN_USERNAME');
  const email = requiredEnvironment('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnvironment('ADMIN_PASSWORD');
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`ADMIN_PASSWORD must contain at least ${MIN_PASSWORD_LENGTH} characters`);

  console.log('Checking for existing admin user...');
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

  console.log('Hashing password...');
  const passwordHash = await hashPassword(password);
  console.log('Creating admin user...');
  console.log('Data to insert:', { username, email, passwordHash, role: 'admin' });

  await prisma.user.create({ data: { username, email, passwordHash, role: 'admin' } });
  console.log(`Created admin account: ${username}`);
};

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});