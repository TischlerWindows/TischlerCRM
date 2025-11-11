import { z } from 'zod';
import path from 'path';
import dotenv from 'dotenv';

// Load env from repo root and local package if present
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const message = Object.entries(flat)
      .map(([k, v]) => `${k}: ${v?.join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}
