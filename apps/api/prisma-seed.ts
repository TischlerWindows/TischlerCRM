import { prisma } from '@crm/db/client';
import bcrypt from 'bcryptjs';
import { loadEnv } from './src/config';

async function main() {
  loadEnv();
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  
  // Delete existing user to re-create with bcrypt hash
  await prisma.user.deleteMany({ where: { email } });
  console.log('Deleted existing user (if any):', email);
  
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('Created hash:', passwordHash);
  console.log('Hash prefix:', passwordHash.substring(0, 10));
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      name: 'Admin'
    }
  });
  console.log('Created admin user:', user.email, 'password:', password);
  console.log('Stored hash:', user.passwordHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});