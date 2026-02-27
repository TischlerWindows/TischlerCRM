import { z } from 'zod';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env from repo root and local package if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const EnvSchema = z.object({
    NODE_ENV: z.string().default('development'),
    APP_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z.string().optional().default('4000'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
});
export function loadEnv() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        const message = Object.entries(flat)
            .map(([k, v]) => `${k}: ${v?.join(', ')}`)
            .join('; ');
        throw new Error(`Invalid environment configuration: ${message}`);
    }
    return parsed.data;
}
