import { jsPDF } from 'jspdf';

import {
  getNineBoxQuadrantMeta,
  NINE_BOX_AXIS_LABELS,
  NINE_BOX_PERFORMANCE_ORDER,
  NINE_BOX_POTENTIAL_ORDER,
} from '@/modules/nineBox/nineBoxQuadrants';
import { DEFAULT_ACCENT_HEX, DEFAULT_PRIMARY_HEX, hexToRgb, normalizeHex } from '@/lib/branding';
import type { NineBoxMatrixRow } from '@/types/nineBox';

const MARGIN_X = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BOTTOM_SAFE = 20;
const MATRIX_HEADER_H = 8;
const MATRIX_ROW_LABEL_W = 19;
const MATRIX_AXIS_CAPTION_H = 8;
const MATRIX_CELL_H = 40;
const AVATAR_BASE_SIZE = 6.2;
const AVATAR_GAP = 1.2;
const PAGE_BG_RGB: [number, number, number] = [247, 249, 252];
const CARD_BG_RGB: [number, number, number] = [255, 255, 255];
const BORDER_RGB: [number, number, number] = [219, 227, 237];

const NINE_BOX_CELL_DESCRIPTIONS: Record<string, string> = {
  'high|high': 'Alta performance e alto potencial para liderar desafios criticos.',
  'high|medium': 'Entrega consistente com potencial para ampliar escopo.',
  'high|low': 'Especialista confiavel, com foco forte na execucao atual.',
  'medium|high': 'Boa base de resultado com potencial acelerado de crescimento.',
  'medium|medium': 'Contribuicao equilibrada, evolui com acompanhamento continuo.',
  'medium|low': 'Executa o esperado em atividades estaveis e bem definidas.',
  'low|high': 'Potencial alto, mas precisa elevar consistencia de entregas.',
  'low|medium': 'Resultados irregulares; requer plano objetivo de desenvolvimento.',
  'low|low': 'Baixa aderencia atual; demanda intervencao e redefinicao de rota.',
};

function safeFileSegment(input: string): string {
  return (
    input
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'NineBox'
  );
}

function blendWithWhite(rgb: [number, number, number], amount: number): [number, number, number] {
  const ratio = Math.max(0, Math.min(1, amount));
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * ratio),
    Math.round(rgb[1] + (255 - rgb[1]) * ratio),
    Math.round(rgb[2] + (255 - rgb[2]) * ratio),
  ];
}

function rgbForTier(
  tier: 'high' | 'mid' | 'low',
  primaryRgb: [number, number, number],
  accentRgb: [number, number, number]
): [number, number, number] {
  if (tier === 'high') return blendWithWhite(primaryRgb, 0.84);
  if (tier === 'mid') return blendWithWhite(accentRgb, 0.84);
  return [246, 246, 246];
}

function drawRoundedCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fillRgb: [number, number, number],
  borderRgb: [number, number, number]
): void {
  doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
  doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
  doc.roundedRect(x, y, w, h, 2.6, 2.6, 'FD');
}

function getDisplayAvatarUrl(row: NineBoxMatrixRow): string | null {
  const profile = row.profiles;
  if (!profile) return null;
  return profile.avatar_thumb_url ?? profile.avatar_url ?? null;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const chunks = trimmed.split(/\s+/).slice(0, 2);
  return chunks
    .map((piece) => piece[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

async function fetchCircularAvatarDataUrl(avatarUrl: string): Promise<string | null> {
  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) return null;
    const avatarBlob = await response.blob();
    const objectUrl = URL.createObjectURL(avatarBlob);

    try {
      const dataUrl = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 72;
            canvas.height = 72;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }

            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            resolve(canvas.toDataURL('image/png'));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = objectUrl;
      });
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function preloadAvatarMap(rows: NineBoxMatrixRow[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const uniqueAvatarUrls = Array.from(
    new Set(rows.map((row) => getDisplayAvatarUrl(row)).filter((value): value is string => Boolean(value)))
  );
  const resolved = await Promise.all(
    uniqueAvatarUrls.map(async (avatarUrl) => ({
      avatarUrl,
      dataUrl: await fetchCircularAvatarDataUrl(avatarUrl),
    }))
  );
  for (const item of resolved) {
    if (item.dataUrl) urlMap.set(item.avatarUrl, item.dataUrl);
  }
  return urlMap;
}

function ensureSpace(doc: jsPDF, y: number, requiredHeight: number): number {
  if (y + requiredHeight <= PAGE_H - BOTTOM_SAFE) return y;
  doc.addPage();
  return MARGIN_X;
}

export function getNineBoxPdfFilename(year: number, generatedAt: Date): string {
  const date = generatedAt.toISOString().slice(0, 10);
  return `${safeFileSegment(`Nine-Box-${year}`)}-${date}.pdf`;
}

export interface NineBoxPdfBranding {
  companyName?: string;
  logoDataUrl?: string;
  primaryColorHex?: string;
  accentColorHex?: string;
}

export async function buildNineBoxPdf(payload: {
  year: number;
  rows: NineBoxMatrixRow[];
  generatedAt: Date;
  branding?: NineBoxPdfBranding;
}): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN_X;

  const drawParagraph = (text: string, fontSize = 10, lineHeight = 5, indent = 0) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
    for (const line of lines) {
      y = ensureSpace(doc, y, lineHeight);
      doc.text(line, MARGIN_X + indent, y);
      y += lineHeight;
    }
  };

  const rowsByCell = new Map<string, NineBoxMatrixRow[]>();
  for (const perf of NINE_BOX_PERFORMANCE_ORDER) {
    for (const pot of NINE_BOX_POTENTIAL_ORDER) {
      rowsByCell.set(`${perf}|${pot}`, []);
    }
  }
  for (const row of payload.rows) {
    const key = `${row.performance}|${row.potential}`;
    const list = rowsByCell.get(key);
    if (list) list.push(row);
  }
  for (const list of rowsByCell.values()) {
    list.sort((a, b) => {
      const aName = a.profiles?.name ?? '';
      const bName = b.profiles?.name ?? '';
      return aName.localeCompare(bName, 'pt-BR');
    });
  }

  const primaryHex = normalizeHex(payload.branding?.primaryColorHex ?? '') ?? DEFAULT_PRIMARY_HEX;
  const accentHex = normalizeHex(payload.branding?.accentColorHex ?? '') ?? DEFAULT_ACCENT_HEX;
  const primaryRgb = hexToRgb(primaryHex);
  const accentRgb = hexToRgb(accentHex);
  const heroBgRgb = primaryRgb;
  const heroSubtleRgb = blendWithWhite(primaryRgb, 0.82);
  const companyName = payload.branding?.companyName?.trim() || 'Eleva';

  const avatarDataByUrl = await preloadAvatarMap(payload.rows);

  doc.setFillColor(PAGE_BG_RGB[0], PAGE_BG_RGB[1], PAGE_BG_RGB[2]);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  if (payload.branding?.logoDataUrl) {
    try {
      const logoCardW = 32;
      const logoCardH = 13;
      const logoCardX = MARGIN_X;
      const logoCardY = y;
      drawRoundedCard(doc, logoCardX, logoCardY, logoCardW, logoCardH, [255, 255, 255], [225, 232, 242]);
      const logoW = 26;
      const logoH = 8.2;
      doc.addImage(payload.branding.logoDataUrl, 'PNG', logoCardX + 3, logoCardY + 2.3, logoW, logoH);
      y += 16;
    } catch {
      // Keep export resilient if logo fails.
    }
  }

  drawRoundedCard(doc, MARGIN_X, y, CONTENT_W, 27, heroBgRgb, heroBgRgb);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Matriz Nine-Box', MARGIN_X + 4, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${companyName} · Objetivos x Competencias`, MARGIN_X + 4, y + 14);
  doc.text(`Ano ${payload.year}`, MARGIN_X + 4, y + 19);
  doc.text(`Gerado em ${payload.generatedAt.toLocaleString('pt-BR')}`, MARGIN_X + 4, y + 23.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(String(payload.rows.length), MARGIN_X + CONTENT_W - 4, y + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('colaboradores', MARGIN_X + CONTENT_W - 4, y + 17, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 34;

  const distribution = {
    high: payload.rows.filter((row) => {
      const meta = getNineBoxQuadrantMeta(row.performance, row.potential);
      return meta.tier === 'high';
    }).length,
    mid: payload.rows.filter((row) => {
      const meta = getNineBoxQuadrantMeta(row.performance, row.potential);
      return meta.tier === 'mid';
    }).length,
    low: payload.rows.filter((row) => {
      const meta = getNineBoxQuadrantMeta(row.performance, row.potential);
      return meta.tier === 'low';
    }).length,
  };

  const metrics = [
    { label: 'Alta prioridade', value: distribution.high, rgb: primaryRgb },
    { label: 'Intermediario', value: distribution.mid, rgb: accentRgb },
    { label: 'A desenvolver', value: distribution.low, rgb: [110, 110, 110] as [number, number, number] },
  ];
  const metricGap = 3;
  const metricW = (CONTENT_W - metricGap * 2) / 3;
  const metricH = 18;
  for (let i = 0; i < metrics.length; i += 1) {
    const metricX = MARGIN_X + i * (metricW + metricGap);
    drawRoundedCard(doc, metricX, y, metricW, metricH, CARD_BG_RGB, BORDER_RGB);
    doc.setTextColor(metrics[i].rgb[0], metrics[i].rgb[1], metrics[i].rgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(metrics[i].value), metricX + 2.5, y + 8.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(metrics[i].label, metricX + 2.5, y + 13.5);
    doc.setDrawColor(heroSubtleRgb[0], heroSubtleRgb[1], heroSubtleRgb[2]);
    doc.line(metricX + 2.5, y + 15.1, metricX + metricW - 2.5, y + 15.1);
  }
  doc.setTextColor(0, 0, 0);
  y += metricH + 7;

  const highestCellCount = Math.max(...Array.from(rowsByCell.values(), (list) => list.length), 0);
  const avatarSize =
    highestCellCount > 24 ? AVATAR_BASE_SIZE - 1.8 : highestCellCount > 12 ? AVATAR_BASE_SIZE - 0.8 : AVATAR_BASE_SIZE;
  const avatarRowsLimit = highestCellCount > 20 ? 3 : 2;
  const matrixGridH = MATRIX_CELL_H * 3;
  const matrixRequiredHeight = MATRIX_AXIS_CAPTION_H + MATRIX_HEADER_H + matrixGridH + 8;
  y = ensureSpace(doc, y, matrixRequiredHeight);

  drawRoundedCard(
    doc,
    MARGIN_X - 1,
    y - 4,
    CONTENT_W + 2,
    MATRIX_AXIS_CAPTION_H + MATRIX_HEADER_H + matrixGridH + 6,
    CARD_BG_RGB,
    BORDER_RGB
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Mapa visual da matriz', MARGIN_X + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(95, 95, 95);
  doc.text('Cada celula mostra label, descricao e avatares dos colaboradores.', MARGIN_X + 2, y + 5.2);
  doc.setTextColor(0, 0, 0);
  y += 8;

  const matrixX = MARGIN_X;
  const gridX = matrixX + MATRIX_ROW_LABEL_W;
  const gridW = CONTENT_W - MATRIX_ROW_LABEL_W;
  const cellW = gridW / 3;

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text('Objetivos (eixo X)', gridX + gridW / 2, y, { align: 'center' });
  y += MATRIX_AXIS_CAPTION_H;

  for (let col = 0; col < NINE_BOX_POTENTIAL_ORDER.length; col += 1) {
    const potential = NINE_BOX_POTENTIAL_ORDER[col];
    const headerX = gridX + col * cellW + cellW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(55, 55, 55);
    doc.text(`Obj. ${NINE_BOX_AXIS_LABELS[potential]}`, headerX, y, { align: 'center' });
  }

  const matrixStartY = y + MATRIX_HEADER_H;

  for (let rowIndex = 0; rowIndex < NINE_BOX_PERFORMANCE_ORDER.length; rowIndex += 1) {
    const performance = NINE_BOX_PERFORMANCE_ORDER[rowIndex];
    const rowY = matrixStartY + rowIndex * MATRIX_CELL_H;
    const rowCenter = rowY + MATRIX_CELL_H / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(55, 55, 55);
    doc.text(`Comp. ${NINE_BOX_AXIS_LABELS[performance]}`, matrixX + 1, rowCenter, {
      baseline: 'middle',
    });

    for (let col = 0; col < NINE_BOX_POTENTIAL_ORDER.length; col += 1) {
      const potential = NINE_BOX_POTENTIAL_ORDER[col];
      const cellX = gridX + col * cellW;
      const cellY = rowY;
      const cellKey = `${performance}|${potential}`;
      const meta = getNineBoxQuadrantMeta(performance, potential);
      const cellRows = rowsByCell.get(cellKey) ?? [];
      const description = NINE_BOX_CELL_DESCRIPTIONS[cellKey] ?? 'Sem descricao';
      const [r, g, b] = rgbForTier(meta.tier, primaryRgb, accentRgb);

      doc.setFillColor(r, g, b);
      doc.setDrawColor(180, 180, 180);
      doc.rect(cellX, cellY, cellW, MATRIX_CELL_H, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(35, 35, 35);
      const titleLines = doc.splitTextToSize(meta.label, cellW - 4) as string[];
      const visibleTitle = titleLines.slice(0, 2);
      for (let i = 0; i < visibleTitle.length; i += 1) {
        doc.text(visibleTitle[i], cellX + 2, cellY + 3.3 + i * 3.3);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(70, 70, 70);
      const descriptionLines = doc.splitTextToSize(description, cellW - 4) as string[];
      const visibleDescription = descriptionLines.slice(0, 3);
      for (let i = 0; i < visibleDescription.length; i += 1) {
        doc.text(visibleDescription[i], cellX + 2, cellY + 10 + i * 2.8);
      }

      const avatarsPerRow = Math.max(1, Math.floor((cellW - 4) / (avatarSize + AVATAR_GAP)));
      const maxRows = avatarRowsLimit;
      const maxVisibleAvatars = avatarsPerRow * maxRows;
      const visibleRows = cellRows.slice(0, maxVisibleAvatars);
      const hiddenCount = Math.max(0, cellRows.length - visibleRows.length);

      for (let index = 0; index < visibleRows.length; index += 1) {
        const row = visibleRows[index];
        const avatarCol = index % avatarsPerRow;
        const avatarRow = Math.floor(index / avatarsPerRow);
        const avatarX = cellX + 2 + avatarCol * (avatarSize + AVATAR_GAP);
        const avatarY =
          cellY + MATRIX_CELL_H - 2 - avatarSize - (maxRows - 1 - avatarRow) * (avatarSize + AVATAR_GAP);
        const employeeName = row.profiles?.name ?? 'Colaborador';
        const fallbackInitials = getInitials(employeeName);
        const avatarUrl = getDisplayAvatarUrl(row);
        const avatarDataUrl = avatarUrl ? avatarDataByUrl.get(avatarUrl) ?? null : null;

        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.35);
        doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'S');

        if (avatarDataUrl) {
          try {
            doc.addImage(avatarDataUrl, 'PNG', avatarX, avatarY, avatarSize, avatarSize);
            continue;
          } catch {
            // Falls back to initials avatar if image drawing fails.
          }
        }

        doc.setFillColor(215, 215, 215);
        doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(avatarSize < 5 ? 4.5 : 5.3);
        doc.setTextColor(80, 80, 80);
        doc.text(fallbackInitials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.4, {
          align: 'center',
        });
      }

      if (hiddenCount > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(90, 90, 90);
        doc.text(`+${hiddenCount}`, cellX + cellW - 2.2, cellY + MATRIX_CELL_H - 2.2, {
          align: 'right',
        });
      }

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(210, 210, 210);
      doc.roundedRect(cellX + cellW - 8.5, cellY + 1.2, 7.2, 4.4, 1, 1, 'FD');
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(String(cellRows.length), cellX + cellW - 4.9, cellY + 4.6, { align: 'center' });
    }
  }

  y = matrixStartY + matrixGridH + 8;
  doc.setTextColor(0, 0, 0);

  const legendY = y;
  drawRoundedCard(doc, MARGIN_X - 1, legendY - 2.5, CONTENT_W + 2, 13.5, CARD_BG_RGB, BORDER_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Legenda de prioridade', MARGIN_X + 2, legendY + 1.8);
  const legendItems = [
    { label: 'Alta', tier: 'high' as const },
    { label: 'Media', tier: 'mid' as const },
    { label: 'Baixa', tier: 'low' as const },
  ];
  for (let i = 0; i < legendItems.length; i += 1) {
    const itemX = MARGIN_X + 2 + i * 39;
    const color = rgbForTier(legendItems[i].tier, primaryRgb, accentRgb);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setDrawColor(198, 198, 198);
    doc.roundedRect(itemX, legendY + 3.5, 5.5, 3.8, 0.8, 0.8, 'FD');
    doc.setTextColor(85, 85, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(legendItems[i].label, itemX + 7.2, legendY + 6.4);
  }
  y += 14;

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${companyName} · Pagina ${page}/${pages}`, PAGE_W - MARGIN_X - 36, PAGE_H - 10);
  }

  return doc.output('blob');
}
