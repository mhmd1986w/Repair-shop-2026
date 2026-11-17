export const BUILT_IN_APP_DOMAIN = 'https://ais-pre-ly6gjlbqotbxgv2cd5mtaf-299604103972.europe-west2.run.app';
export const DEVELOPMENT_APP_DOMAIN = 'https://ais-dev-ly6gjlbqotbxgv2cd5mtaf-299604103972.europe-west2.run.app';
export const FIREBASE_HOSTING_DOMAIN = 'https://gen-lang-client-0706732363.web.app';
export const STORAGE_KEY_WEBSITE_DOMAIN = 'websiteDomain';

export function normalizeDomainUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return BUILT_IN_APP_DOMAIN;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return BUILT_IN_APP_DOMAIN;
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return BUILT_IN_APP_DOMAIN;
  }
}

export function getDefaultBuiltInDomain(): string {
  if (typeof window === 'undefined') return BUILT_IN_APP_DOMAIN;
  const origin = window.location.origin || '';
  if (
    !origin ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('file://') ||
    origin.startsWith('capacitor://') ||
    origin.includes('ais-dev-')
  ) {
    return BUILT_IN_APP_DOMAIN;
  }
  return origin.replace(/\/+$/, '');
}

export function getEffectiveAppUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY_WEBSITE_DOMAIN);
    if (stored && stored.trim()) {
      return normalizeDomainUrl(stored);
    }
  }
  return getDefaultBuiltInDomain();
}

export function buildTrackingUrl(orderId: string, overrideOrigin?: string): string {
  const base = overrideOrigin ? normalizeDomainUrl(overrideOrigin) : getEffectiveAppUrl();
  return `${base}?track=${encodeURIComponent(orderId)}`;
}
