import crypto from 'crypto';
import { prisma } from '@crm/db/client';
const ITERATIONS = 310_000;
const KEYLEN = 32;
const DIGEST = 'sha256';
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    return `pbkdf2$${ITERATIONS}$${DIGEST}$${salt}$${derived}`;
}
export function verifyPassword(password, stored) {
    try {
        const parts = stored.split('$');
        if (parts.length !== 5)
            return false;
        const [algo, iterStr, digest, salt, keyHex] = parts;
        if (!algo || !algo.startsWith('pbkdf2'))
            return false;
        const iter = Number(iterStr) || ITERATIONS;
        if (!salt || !keyHex)
            return false;
        const derivedHex = crypto.pbkdf2Sync(password, salt, iter, KEYLEN, digest).toString('hex');
        const keyBuf = new Uint8Array(Buffer.from(keyHex, 'hex'));
        const derivedBuf = new Uint8Array(Buffer.from(derivedHex, 'hex'));
        if (keyBuf.byteLength !== derivedBuf.byteLength)
            return false;
        return crypto.timingSafeEqual(keyBuf, derivedBuf);
    }
    catch {
        return false;
    }
}
function base64urlStr(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
function base64urlBuffer(buf) {
    return buf
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
export function signJwt(payload, secret, ttlSeconds = 3600) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const full = { ...payload, exp };
    const encHeader = base64urlStr(JSON.stringify(header));
    const encPayload = base64urlStr(JSON.stringify(full));
    const data = `${encHeader}.${encPayload}`;
    const signatureRaw = crypto.createHmac('sha256', secret).update(data).digest();
    const signature = base64urlBuffer(signatureRaw);
    return `${data}.${signature}`;
}
export function verifyJwt(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    const [h, p, s] = parts;
    const expectedSig = base64urlBuffer(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
    if (expectedSig !== s)
        return null;
    try {
        const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
        if (payload.exp < Math.floor(Date.now() / 1000))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
export async function authenticate(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash)
        return null;
    return verifyPassword(password, user.passwordHash) ? user : null;
}
