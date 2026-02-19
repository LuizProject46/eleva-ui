/**
 * Generates a course certificate as a PDF blob.
 * Uses tenant whitelabel (logo, company name, colors) when provided.
 */

import { jsPDF } from 'jspdf';
import type { CertificatePdfPayload } from '@/types/courses';

import cormorantFontUrl from '../../docs/CormorantGaramond-Italic-VariableFont_wght.ttf?url';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN = 25;
const FRAME_OFFSET = 15;
const FRAME_INNER = 20;
const CONTENT_W = PAGE_W_MM - 2 * MARGIN;
const FOOTER_BOTTOM_MM = 45;

const DEFAULT_FRAME_RGB = { r: 0xc9, g: 0xa2, b: 0x4d };
const DEFAULT_ACCENT_RGB = { r: 0x1f, g: 0x3d, b: 0x2b };

const PAGE_BG_HEX = '#fbf8f2';

const CORMORANT_FONT_ID = 'CormorantGaramond';
const CORMORANT_VFS_NAME = 'CormorantGaramond-Italic-VariableFont_wght.ttf';
/** Fallback when custom font is not available. */
const FONT_FALLBACK = 'times';

let cachedCormorantBinary: string | null = null;

async function loadCormorantBinary(): Promise<string> {
  if (cachedCormorantBinary) return cachedCormorantBinary;
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const url = cormorantFontUrl.startsWith('http') ? cormorantFontUrl : base + cormorantFontUrl;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font load failed: ${res.status}`);
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const binary: string[] = [];
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary.push(String.fromCharCode(...slice));
  }
  cachedCormorantBinary = binary.join('');
  return cachedCormorantBinary;
}

function registerCormorantFont(doc: jsPDF, fontBinary: string): void {
  doc.addFileToVFS(CORMORANT_VFS_NAME, fontBinary);
  doc.addFont(CORMORANT_VFS_NAME, CORMORANT_FONT_ID, 'italic');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, '').trim();
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    const n = parseInt(cleaned, 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }
  return DEFAULT_ACCENT_RGB;
}

function drawDoubleFrame(
  doc: jsPDF,
  colorHex?: string
) {
  const rgb = colorHex ? hexToRgb(colorHex) : DEFAULT_FRAME_RGB;
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(3);
  doc.rect(FRAME_OFFSET, FRAME_OFFSET, PAGE_W_MM - 2 * FRAME_OFFSET, PAGE_H_MM - 2 * FRAME_OFFSET);
  doc.setLineWidth(1);
  doc.rect(FRAME_INNER, FRAME_INNER, PAGE_W_MM - 2 * FRAME_INNER, PAGE_H_MM - 2 * FRAME_INNER);
}

function formatWorkload(workloadHours: number | null): string {
  if (workloadHours == null) return '—';
  return workloadHours === 1 ? '1 hora' : `${workloadHours} horas`;
}

/**
 * Builds the certificate PDF and returns a Blob for download.
 * Uses payload.branding for whitelabel (logo, company name, colors).
 * Uses Cormorant Garamond from docs when available; falls back to Times.
 */
export async function buildCertificatePdf(payload: CertificatePdfPayload): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let fontName = FONT_FALLBACK;
  let fontStyleNormal: 'normal' | 'italic' = 'normal';
  let fontStyleBold: 'bold' | 'italic' = 'bold';
  try {
    const fontBinary = await loadCormorantBinary();
    registerCormorantFont(doc, fontBinary);
    fontName = CORMORANT_FONT_ID;
    fontStyleBold = 'italic';
  } catch {
    // use built-in times
  }

  const branding = payload.branding;
  const primaryHex = branding?.primaryColorHex;
  const accentRgb = primaryHex ? hexToRgb(primaryHex) : DEFAULT_ACCENT_RGB;
  let y = 35;

  doc.setFillColor(PAGE_BG_HEX);
  doc.rect(0, 0, PAGE_W_MM, PAGE_H_MM, 'F');

  drawDoubleFrame(doc, primaryHex ?? undefined);

  // Logo (whitelabel) at top
  if (branding?.logoDataUrl) {
    try {
      const logoW = 50;
      const logoH = 18;
      const logoX = (PAGE_W_MM - logoW) / 2;
      doc.addImage(branding.logoDataUrl, 'PNG', logoX, 22, logoW, logoH);
      y = 22 + logoH + 20;
    } catch {
      y = 35;
    }
  }

  // Title
  doc.setFontSize(35);
  doc.setFont(fontName, fontStyleBold);
  doc.setTextColor('#2d2d2d');
  doc.text('CERTIFICADO DE', PAGE_W_MM / 2, y, { align: 'center' })
  doc.text('CONCLUSÃO', PAGE_W_MM / 2, y + 14, { align: 'center' });
  y += 30;

  // "Este certificado é concedido a"
  doc.setFontSize(15);
  doc.setFont(fontName, fontStyleNormal);
  doc.text('Este certificado é concedido a', PAGE_W_MM / 2, y, { align: 'center' });
  y += 24;

  // User name (emphasized, tenant color)
  doc.setFontSize(48);
  doc.setFont(fontName, fontStyleBold);
  doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
  const nameLines = doc.splitTextToSize(payload.userName, CONTENT_W - 40);
  const nameLineWidths = nameLines.map((line: string) => doc.getTextWidth(line));
  const nameBlockWidth = Math.max(...nameLineWidths);
  nameLines.forEach((line: string) => {
    doc.text(line, PAGE_W_MM / 2, y, { align: 'center' });
    y += 8;
  });
  doc.setTextColor(0, 0, 0);

  // Underline matching userName width (centered)
  doc.setLineWidth(0.2);
  doc.setDrawColor(0x99, 0x99, 0x99);
  const lineStartX = PAGE_W_MM / 2 - nameBlockWidth / 2;
  const lineEndX = PAGE_W_MM / 2 + nameBlockWidth / 2;
  doc.line(lineStartX, y, lineEndX, y);

  y += 15;


  // "pela conclusão do curso"
  doc.setFontSize(15);
  doc.setFont(fontName, fontStyleNormal);
  doc.text('pela conclusão do curso', PAGE_W_MM / 2, y, { align: 'center' });
  y += 12;

  // Course name (tenant color)
  doc.setFontSize(22);
  doc.setFont(fontName, fontStyleBold);
  doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
  const courseLines = doc.splitTextToSize(payload.courseName, CONTENT_W - 20);
  courseLines.forEach((line: string) => {
    doc.text(line, PAGE_W_MM / 2, y, { align: 'center' });
    y += 7;
  });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Details block (workload with correct Portuguese: 1 hora / X horas)
  doc.setFontSize(13);
  doc.setFont(fontName, fontStyleNormal);
  const workloadStr = formatWorkload(payload.workloadHours);
  const details = [
    `Carga horária: ${workloadStr}`,
    `Código do certificado: ${payload.certificateCode}`,
    `Data de conclusão: ${payload.completionDate}`,
  ];
  details.forEach((line) => {
    doc.text(line, PAGE_W_MM / 2, y, { align: 'center' });
    y += 8;
  });

  // Footer: signature (company name), center placeholder, QR + validation
  const footerY = PAGE_H_MM - FOOTER_BOTTOM_MM;
  const colW = CONTENT_W / 3;
  const col1X = MARGIN;
  const col3X = MARGIN + 2 * colW;
  const companyName = branding?.companyName ?? 'Assinatura';

  // doc.setFontSize(10);
  // doc.setFont(fontName, fontStyleNormal);
  // doc.text(companyName, col1X + colW / 2, footerY, { align: 'center' });

  doc.setFontSize(7);
  doc.text('Verifique a autenticidade:', col3X + colW / 2, footerY, { align: 'center' });
  doc.text(payload.validationUrl || '—', col3X + colW / 2, footerY + 6, { align: 'center' });

  const qrSize = 28;
  const qrX = col3X + (colW - qrSize) / 2;
  const qrY = footerY - qrSize - 4;
  try {
    doc.addImage(payload.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {
    doc.setFontSize(8);
    doc.setFont(fontName, fontStyleNormal);
    doc.text('[QR]', col3X + colW / 2, qrY + qrSize / 2 - 2, { align: 'center' });
  }

  return doc.output('blob');
}
