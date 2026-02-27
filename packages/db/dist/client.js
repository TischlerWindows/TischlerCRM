import { PrismaClient } from '@prisma/client';
// Singleton for serverless reuse
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        log: ['warn', 'error']
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
