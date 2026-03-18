/**
 * PDI export as PDF: identification, results summary, context, action plans.
 * Uses jsPDF only (no React/Tailwind).
 */

import { jsPDF } from 'jspdf';
import type { Pdi, PdiActionPlan, PdiPlanAction } from '@/types/pdi';
import { PDI_CLOSE_RESULT_LABELS, PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';
import { PDI_TYPE_LABELS } from '@/constants/pdiTypes';
import { ACTION_PLAN_TYPE_LABELS } from '@/constants/actionPlanTypes';
import type { ActionPlanType } from '@/constants/actionPlanTypes';
import type { PdiProgressStatus } from '@/modules/pdi/utils/derivePdiStatus';

const MARGIN = 16;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = PAGE_H - MARGIN;
const BOTTOM_SAFE = 22;

/** Header / accent (slate-blue, prints well) */
const ACCENT: [number, number, number] = [30, 64, 175];
const ACCENT_LIGHT: [number, number, number] = [238, 242, 255];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

export interface PdiPdfPayload {
  pdi: Pdi;
  employeeName: string;
  actionPlans: PdiActionPlan[];
  planActions: PdiPlanAction[];
  progressStatus: PdiProgressStatus | null;
  completedActions: number;
  totalActions: number;
  progressPct: number;
  contextCourseTitles: string[];
  generatedAt: Date;
}

function planTypeLabel(type: string): string {
  return ACTION_PLAN_TYPE_LABELS[type as ActionPlanType] ?? type;
}

function progressStatusLabel(s: PdiProgressStatus | null): string {
  if (!s) return '—';
  if (s === 'completed') return 'Concluído (todas as ações)';
  if (s === 'overdue') return 'Em atraso (há planos com prazo vencido)';
  return 'Em andamento';
}

function safeFileSegment(s: string): string {
  return s
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'PDI';
}

export function getPdiPdfFilename(payload: PdiPdfPayload): string {
  const title = payload.pdi.title?.trim() || 'Plano';
  const date = payload.generatedAt.toISOString().slice(0, 10);
  return `PDI-${safeFileSegment(title)}-${date}.pdf`;
}

export function buildPdiPdf(payload: PdiPdfPayload): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  const newPage = () => {
    doc.addPage();
    y = MARGIN;
  };

  const ensureSpace = (mm: number) => {
    if (y + mm > PAGE_H - BOTTOM_SAFE) newPage();
  };

  const drawWrapped = (text: string, fontSize: number, indent = 0, lineH = 5) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines as string[]) {
      ensureSpace(lineH);
      doc.text(line, MARGIN + indent, y);
      y += lineH;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(12);
    y += 4;
    doc.setFillColor(...ACCENT_LIGHT);
    doc.roundedRect(MARGIN, y - 4, CONTENT_W, 9, 1, 1, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(title, MARGIN + 3, y + 2.5);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  const keyValue = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const labelW = doc.getTextWidth(label) + 2;
    const lines = doc.splitTextToSize(value, CONTENT_W - labelW - 2);
    const first = (lines as string[])[0] ?? '';
    doc.text(first, MARGIN + labelW, y);
    y += 5;
    for (let i = 1; i < (lines as string[]).length; i++) {
      ensureSpace(5);
      doc.text((lines as string[])[i], MARGIN + labelW, y);
      y += 5;
    }
  };

  // —— Cover header (height grows with title lines) ——
  const displayTitle = payload.pdi.title?.trim() || 'Sem título definido';
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(displayTitle, CONTENT_W) as string[];
  const titleLineCount = Math.min(titleLines.length, 4);
  const headerH = 28 + titleLineCount * 5 + 6;
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_W, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento gerado automaticamente', MARGIN, 14);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Plano de Desenvolvimento Individual', MARGIN, 24);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let ty = 30;
  for (let i = 0; i < titleLineCount; i++) {
    let line = titleLines[i] ?? '';
    if (i === titleLineCount - 1 && titleLines.length > titleLineCount) {
      const shortened = doc.splitTextToSize(`${line}…`, CONTENT_W - 4)[0] as string;
      line = shortened.endsWith('…') ? shortened : `${shortened.slice(0, -1)}…`;
    }
    doc.text(line, MARGIN, ty);
    ty += 5;
  }
  doc.setTextColor(0, 0, 0);
  y = headerH + 8;

  sectionTitle('Identificação');
  keyValue('Título:', displayTitle);
  keyValue('Colaborador:', payload.employeeName || payload.pdi.employee_id);
  keyValue('Tipo de PDI:', PDI_TYPE_LABELS[payload.pdi.type] ?? payload.pdi.type);
  keyValue('Status:', PDI_STATUS_LABELS[payload.pdi.status] ?? payload.pdi.status);
  keyValue(
    'Criado em:',
    new Date(payload.pdi.created_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
  keyValue(
    'Última atualização:',
    new Date(payload.pdi.updated_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  // —— Results summary ——
  sectionTitle('Resumo dos resultados');
  const { completedActions, totalActions, progressPct, progressStatus, pdi } = payload;

  if (totalActions > 0) {
    ensureSpace(14);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Progresso das ações', MARGIN, y);
    y += 4;
    const barY = y;
    const barH = 5;
    const barW = CONTENT_W * 0.55;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(MARGIN, barY, barW, barH, 1, 1, 'FD');
    const fillW = Math.max(0, (barW * progressPct) / 100);
    if (fillW > 0.5) {
      doc.setFillColor(...ACCENT);
      doc.roundedRect(MARGIN, barY, fillW, barH, 1, 1, 'F');
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${progressPct}%`, MARGIN + barW + 4, barY + 4);
    y = barY + barH + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    drawWrapped(
      `${completedActions} de ${totalActions} ações concluídas. Andamento do plano: ${progressStatusLabel(progressStatus)}.`,
      10,
      0,
      5
    );
  } else {
    drawWrapped('Nenhuma ação cadastrada neste PDI.', 10);
  }

  if (pdi.status === 'closed' || pdi.status === 'archived') {
    y += 2;
    if (pdi.result) {
      keyValue('Resultado do encerramento:', PDI_CLOSE_RESULT_LABELS[pdi.result]);
    }
    if (pdi.closed_at) {
      keyValue(
        'Data do encerramento:',
        new Date(pdi.closed_at).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    }
    ensureSpace(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Comentários do gestor', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const comment = pdi.close_comment?.trim() || 'Nenhum comentário informado no encerramento.';
    drawWrapped(comment, 9, 0, 4.5);
  }

  // —— Context ——
  if (payload.contextCourseTitles.length > 0) {
    sectionTitle('Contexto (cursos concluídos)');
    drawWrapped(
      'Cursos concluídos pelo colaborador que podem informar o desenvolvimento:',
      9
    );
    y += 1;
    for (const t of payload.contextCourseTitles) {
      ensureSpace(5);
      doc.setFontSize(9);
      doc.text(`• ${t}`, MARGIN + 2, y);
      y += 5;
    }
  }

  // —— Action plans ——
  sectionTitle('Planos de ação e tarefas');
  const plansSorted = [...payload.actionPlans].sort((a, b) => a.position - b.position);
  const actionsByPlan = new Map<string, PdiPlanAction[]>();
  for (const a of payload.planActions) {
    const list = actionsByPlan.get(a.pdi_action_plan_id) ?? [];
    list.push(a);
    actionsByPlan.set(a.pdi_action_plan_id, list);
  }
  for (const a of actionsByPlan.values()) {
    a.sort((x, y) => x.position - y.position);
  }

  if (plansSorted.length === 0) {
    drawWrapped('Nenhum plano de ação cadastrado.', 10);
  }

  plansSorted.forEach((plan, idx) => {
    const actions = actionsByPlan.get(plan.id) ?? [];
    ensureSpace(14);
    y += 3;
    const blockTop = y;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(252, 252, 254);
    doc.roundedRect(MARGIN, blockTop, CONTENT_W, 8, 1.5, 1.5, 'FD');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(`Plano ${idx + 1}`, MARGIN + 3, blockTop + 5.5);
    doc.setTextColor(0, 0, 0);
    y = blockTop + 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    keyValue('Tipo:', planTypeLabel(plan.type));
    keyValue(
      'Data de entrega:',
      new Date(plan.delivery_date + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    );
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Descrição do plano', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    drawWrapped(plan.description?.trim() || '—', 9, 0, 4.5);
    y += 2;
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Tarefas', MARGIN, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    if (actions.length === 0) {
      drawWrapped('Nenhuma tarefa neste plano.', 9);
    } else {
      for (const act of actions) {
        const mark = act.completed ? '[x]' : '[ ]';
        drawWrapped(`${mark} ${act.description}`, 9, 2, 4.5);
      }
    }
    y += 4;
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Eleva · Gerado em ${payload.generatedAt.toLocaleString('pt-BR')} · Página ${p}/${pageCount}`,
      MARGIN,
      FOOTER_Y
    );
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
}
