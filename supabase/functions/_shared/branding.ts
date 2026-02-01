export interface TenantBranding {
  companyName: string;
  logoUrl?: string | null;
  primaryColorHex: string;
  accentColorHex: string;
  appUrl: string;
}

const DEFAULT_PRIMARY = '#2d7a4a';
const DEFAULT_ACCENT = '#f59e0b';

function hslToHex(hslStr: string): string {
  const match = hslStr.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return DEFAULT_PRIMARY;
  const h = parseInt(match[1], 10) / 360;
  const s = parseInt(match[2], 10) / 100;
  const l = parseInt(match[3], 10) / 100;
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

export function parseTenantToBranding(tenant: {
  company_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  app_url?: string | null;
} | null, siteUrl: string): TenantBranding {
  if (!tenant) {
    return {
      companyName: 'Eleva',
      primaryColorHex: DEFAULT_PRIMARY,
      accentColorHex: DEFAULT_ACCENT,
      appUrl: siteUrl,
    };
  }
  return {
    companyName: tenant.company_name ?? 'Eleva',
    logoUrl: tenant.logo_url,
    primaryColorHex: tenant.primary_color ? hslToHex(tenant.primary_color) : DEFAULT_PRIMARY,
    accentColorHex: tenant.accent_color ? hslToHex(tenant.accent_color) : DEFAULT_ACCENT,
    appUrl: tenant.app_url ?? siteUrl,
  };
}
