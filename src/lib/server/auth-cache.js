import { createHash } from 'node:crypto';

const verifiedTokenCache = new Map();
const MAX_AUTH_CACHE_ENTRIES = 500;

export function getAuthCookieFingerprint(cookiesList) {
  if (!Array.isArray(cookiesList) || cookiesList.length === 0) return null;
  const authCookies = cookiesList
    .filter((c) => c?.name && c.name.startsWith('sb-') && c.name.includes('-auth-token') && c.value)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (authCookies.length === 0) return null;
  const raw = authCookies.map((c) => `${c.name}=${c.value}`).join(';');
  return createHash('sha256').update(raw).digest('hex');
}

export function clearVerifiedAuthCache(fingerprint = null) {
  if (fingerprint) {
    verifiedTokenCache.delete(fingerprint);
  } else {
    verifiedTokenCache.clear();
  }
}

export function getCachedVerifiedUser(fingerprint) {
  if (!fingerprint) return null;
  const entry = verifiedTokenCache.get(fingerprint);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    verifiedTokenCache.delete(fingerprint);
    return null;
  }
  return structuredClone(entry.user);
}

export function setCachedVerifiedUser(fingerprint, user, ttlMs) {
  if (!fingerprint || !user || ttlMs <= 0) return;
  if (verifiedTokenCache.size >= MAX_AUTH_CACHE_ENTRIES) {
    const oldestKey = verifiedTokenCache.keys().next().value;
    verifiedTokenCache.delete(oldestKey);
  }
  verifiedTokenCache.set(fingerprint, {
    user: structuredClone(user),
    expiresAt: Date.now() + ttlMs
  });
}
