/**
 * Generates a course certificate as a PDF blob.
 * Uses tenant whitelabel (logo, company name, colors) when provided.
 */

import { jsPDF } from 'jspdf';
import type { CertificatePdfPayload } from '@/types/courses';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN = 25;
const FRAME_OFFSET = 15;
const FRAME_INNER = 20;
const CONTENT_W = PAGE_W_MM - 2 * MARGIN;
const FOOTER_BOTTOM_MM = 45;

const DEFAULT_FRAME_RGB = { r: 0xc9, g: 0xa2, b: 0x4d };
const DEFAULT_ACCENT_RGB = { r: 0x1f, g: 0x3d, b: 0x2b };

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
 */
export function buildCertificatePdf(payload: CertificatePdfPayload): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const branding = payload.branding;
  const primaryHex = branding?.primaryColorHex;
  const accentRgb = primaryHex ? hexToRgb(primaryHex) : DEFAULT_ACCENT_RGB;
  let y = 35;

  drawDoubleFrame(doc, primaryHex ?? undefined);

  // Logo (whitelabel) at top
  if (branding?.logoDataUrl) {
    try {
      const logoW = 50;
      const logoH = 18;
      const logoX = (PAGE_W_MM - logoW) / 2;
      doc.addImage(branding.logoDataUrl, 'PNG', logoX, 22, logoW, logoH);
      y = 22 + logoH + 12;
    } catch {
      y = 35;
    }
  }

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICADO DE CONCLUSÃO', PAGE_W_MM / 2, y, { align: 'center' });
  y += 14;

  // "Este certificado é concedido a"
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Este certificado é concedido a', PAGE_W_MM / 2, y, { align: 'center' });
  y += 10;

  // User name (emphasized, tenant color)
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
  const nameLines = doc.splitTextToSize(payload.userName, CONTENT_W - 40);
  nameLines.forEach((line: string) => {
    doc.text(line, PAGE_W_MM / 2, y, { align: 'center' });
    y += 8;
  });
  doc.setTextColor(0, 0, 0);
  y += 4;

  // "pela conclusão do curso"
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('pela conclusão do curso', PAGE_W_MM / 2, y, { align: 'center' });
  y += 10;

  // Course name (tenant color)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
  const courseLines = doc.splitTextToSize(payload.courseName, CONTENT_W - 20);
  courseLines.forEach((line: string) => {
    doc.text(line, PAGE_W_MM / 2, y, { align: 'center' });
    y += 7;
  });
  doc.setTextColor(0, 0, 0);
  y += 16;

  // Details block (workload with correct Portuguese: 1 hora / X horas)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
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

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(companyName, col1X + colW / 2, footerY, { align: 'center' });

  doc.setFontSize(9);
  doc.text('Verifique a autenticidade:', col3X + colW / 2, footerY, { align: 'center' });
  doc.text(payload.validationUrl || '—', col3X + colW / 2, footerY + 6, { align: 'center' });

  const qrSize = 28;
  const qrX = col3X + (colW - qrSize) / 2;
  const qrY = footerY - qrSize - 4;
  try {
    doc.addImage(payload.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {
    doc.setFontSize(8);
    doc.text('[QR]', col3X + colW / 2, qrY + qrSize / 2 - 2, { align: 'center' });
  }

  return doc.output('blob');
}
