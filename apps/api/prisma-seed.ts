import { prisma } from '@crm/db/client';
import { hashPassword } from './src/auth';
import { loadEnv } from './src/config';

async function main() {
  loadEnv();
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists:', email);
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      name: 'Admin'
    }
  });
  console.log('Created admin user:', user.email, 'password:', password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});