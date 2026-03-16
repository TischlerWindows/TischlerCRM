/**
 * Encryption utility for securing integration tokens and API keys at rest.
 *
 * Uses AES-256-GCM which provides both confidentiality and authenticity.
 * Each encryption produces a unique IV, so the same plaintext never produces
 * the same ciphertext — important for stored OAuth tokens.
 *
 * Requires ENCRYPTION_KEY env var (64-char hex string = 32 bytes).
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Derives the 32-byte encryption key from the ENCRYPTION_KEY env var.
 * Falls back to JWT_SECRET (hashed to 32 bytes) if ENCRYPTION_KEY is not set,
 * but logs a warning — production should always set a dedicated key.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    // Expect a 64-character hex string (32 bytes)
    if (envKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(envKey)) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
    }
    return Buffer.from(envKey, 'hex');
  }

  // Fallback: derive from JWT_SECRET (acceptable for dev, not ideal for prod)
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Neither ENCRYPTION_KEY nor JWT_SECRET is set. Cannot encrypt.');
  }
  console.warn(
    '[crypto] ENCRYPTION_KEY not set — deriving from JWT_SECRET. Set ENCRYPTION_KEY in production.'
  );
  return crypto.createHash('sha256').update(jwtSecret).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a single string in the format:  iv:authTag:ciphertext  (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string produced by encrypt().
 * Returns the original plaintext, or throws if tampered/wrong key.
 */
export function decrypt(encryptedStr: string): string {
  const key = getEncryptionKey();
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format — expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a value only if it's a non-empty string. Returns null for null/undefined/empty.
 * Useful for optional fields like refreshToken.
 */
export function encryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Decrypt a value only if it's a non-empty string. Returns null for null/undefined/empty.
 */
export function decryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null;
  return decrypt(value);
}
