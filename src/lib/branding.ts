/**
 * Whitelabel branding: single source of truth for primary color (hex),
 * cache and CSS variable application without flicker.
 */

export const BRANDING_CACHE_KEY = 'branding_config';

export const DEFAULT_PRIMARY_HEX = '#2d7a4a';
export const DEFAULT_ACCENT_HEX = '#f59e0b';

export interface BrandingConfig {
  primaryColor: string;
  accentColor?: string;
  logoUrl?: string;
  loginCoverUrl?: string;
  companyName?: string;
}

/** Normalize hex to #RRGGBB (6 digits). */
export function normalizeHex(hex: string): string | null {
  const cleaned = hex.replace(/^#/, '').trim();
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) return `#${cleaned}`;
  if (/^[0-9A-Fa-f]{3}$/.test(cleaned)) {
    const r = cleaned[0]! + cleaned[0];
    const g = cleaned[1]! + cleaned[1];
    const b = cleaned[2]! + cleaned[2];
    return `#${r}${g}${b}`;
  }
  return null;
}

/**
 * Convert hex to HSL string for Tailwind (e.g. "145 75% 38%").
 */
export function hexToHsl(hex: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return '145 75% 38%'; // fallback green

  const n = parseInt(normalized.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
}

/** Check if a string looks like hex (with or without #). */
export function isHexColor(value: string): boolean {
  return /^#?[0-9A-Fa-f]{3}$/.test(value.trim()) || /^#?[0-9A-Fa-f]{6}$/.test(value.trim());
}

/**
 * Convert HSL string (e.g. "145 75% 38%") to hex for legacy tenant values.
 */
export function hslToHex(hslStr: string): string {
  const match = hslStr.trim().match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return DEFAULT_PRIMARY_HEX;
  const h = parseInt(match[1]!, 10) / 360;
  const s = parseInt(match[2]!, 10) / 100;
  const l = parseInt(match[3]!, 10) / 100;

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Apply branding to CSS variables. Primary in hex sets --color-primary and --primary (HSL).
 * Call synchronously on bootstrap from cache to avoid flicker.
 */
export function applyBrandingToCss(config: Partial<BrandingConfig>): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const primaryHex = config.primaryColor
    ? (normalizeHex(config.primaryColor) ?? DEFAULT_PRIMARY_HEX)
    : DEFAULT_PRIMARY_HEX;
  root.style.setProperty('--color-primary', primaryHex);

  const primaryHsl = hexToHsl(primaryHex);
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--brand-primary', primaryHsl);
  root.style.setProperty('--ring', primaryHsl);
  root.style.setProperty('--gradient-hero', `linear-gradient(135deg, ${primaryHex} 0%, ${primaryHex} 50%, ${primaryHex} 100%)`);

  const primaryLight = primaryHsl.replace(/\d+%$/, '50%');
  const primaryDark = primaryHsl.replace(/\d+%$/, '28%');
  root.style.setProperty('--brand-primary-light', primaryLight);
  root.style.setProperty('--brand-primary-dark', primaryDark);

  root.style.setProperty('--sidebar-primary', primaryLight);
  root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
  root.style.setProperty('--sidebar-ring', primaryLight);

  root.style.setProperty('--shadow-elevated', `0 20px 40px -15px hsl(${primaryHsl} / 0.15)`);

  if (config.accentColor) {
    const accentHex = normalizeHex(config.accentColor) ?? DEFAULT_ACCENT_HEX;
    const accentHsl = hexToHsl(accentHex);
    root.style.setProperty('--accent', accentHsl);
    root.style.setProperty('--brand-accent', accentHsl);
    root.style.setProperty('--brand-accent-light', accentHsl.replace(/\d+%$/, '65%'));
  }
}

/**
 * Read cached branding from localStorage and apply to CSS.
 * Call before first paint (e.g. in main.tsx before React render).
 */
export function applyBrandingCacheToCss(): void {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return;
    const config = JSON.parse(raw) as Partial<BrandingConfig>;
    if (config && (config.primaryColor || config.accentColor)) {
      applyBrandingToCss(config);
    }
  } catch {
    // ignore invalid cache
  }
}

/**
 * Save branding config to localStorage (after successful save in Settings).
 */
export function saveBrandingCache(config: BrandingConfig): void {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(config));
  } catch {
    // ignore quota errors
  }
}
