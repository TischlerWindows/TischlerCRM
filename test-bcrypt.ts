import { prisma } from './packages/db/src/client';
import bcrypt from 'bcryptjs';

async function test() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('User found:', user.email);
  console.log('Hash from DB:', user.passwordHash);
  console.log('Hash length:', user.passwordHash?.length);
  
  const password = 'ChangeMe123!';
  console.log('Testing password:', password);
  
  // Test the comparison
  const result = await bcrypt.compare(password, user.passwordHash!);
  console.log('Comparison result:', result);
  
  // Generate a new hash for comparison
  const newHash = await bcrypt.hash(password, 10);
  console.log('New hash:', newHash);
  console.log('New hash length:', newHash.length);
  
  const newResult = await bcrypt.compare(password, newHash);
  console.log('New comparison result:', newResult);
}

test().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
