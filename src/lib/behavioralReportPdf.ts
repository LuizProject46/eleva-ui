/**
 * Generates a DISC behavioral assessment report as a PDF blob.
 * Isolated module: no React, no Tailwind; uses jsPDF for layout.
 */

import { jsPDF } from 'jspdf';
import type { DiscKey } from '@/constants/discProfiles';
import {
  discProfileData,
  discAttentionPoints,
  DISC_KEYS,
} from '@/constants/discProfiles';

export interface BehavioralReportPayload {
  employeeName: string;
  employeeRole: string | null;
  department: string | null;
  team: string | null;
  primaryResult: DiscKey;
  answers: Record<string, DiscKey>;
  totalQuestions: number;
  completedAt: string;
  evaluator?: string | null;
}

const TITLE = 'Relatório de Avaliação Comportamental (DISC)';
const MARGIN = 20;
const LINE_HEIGHT = 6;
const SECTION_GAP = 10;

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function getPercentages(
  answers: Record<string, DiscKey>,
  totalQuestions: number
): Record<DiscKey, number> {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  Object.values(answers).forEach((v) => {
    counts[v]++;
  });
  return {
    D: totalQuestions > 0 ? (counts.D / totalQuestions) * 100 : 0,
    I: totalQuestions > 0 ? (counts.I / totalQuestions) * 100 : 0,
    S: totalQuestions > 0 ? (counts.S / totalQuestions) * 100 : 0,
    C: totalQuestions > 0 ? (counts.C / totalQuestions) * 100 : 0,
  };
}

/**
 * Builds the PDF and returns a Blob for download.
 */
export function buildBehavioralReportPdf(payload: BehavioralReportPayload): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.getPageWidth();
  const contentWidth = pageWidth - 2 * MARGIN;
  let y = MARGIN;

  // Helper: wrap text and advance y
  function drawText(text: string, fontSize: number, opts?: { bold?: boolean }) {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line: string) => {
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    });
  }

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(TITLE, MARGIN, y);
  y += LINE_HEIGHT * 2;

  // Employee block
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Identificação', MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const employeeLines = [
    `Nome: ${payload.employeeName}`,
    `Cargo: ${payload.employeeRole ?? '—'}`,
    `Setor: ${payload.department ?? '—'}`,
    `Equipe: ${payload.team ?? '—'}`,
  ];
  employeeLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  });
  y += SECTION_GAP;

  // Primary profile overview
  const primary = discProfileData[payload.primaryResult];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Perfil predominante', MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${payload.primaryResult} - ${primary.name}`, MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(primary.description, contentWidth);
  descLines.forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  });
  y += SECTION_GAP;

  // Bar chart (D, I, S, C percentages)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Distribuição por dimensão', MARGIN, y);
  y += LINE_HEIGHT;

  const percentages = getPercentages(payload.answers, payload.totalQuestions);
  const barHeight = 5;
  const barMaxWidth = contentWidth * 0.6;
  const labelWidth = 12;

  DISC_KEYS.forEach((key) => {
    const pct = Math.round(percentages[key]);
    const profile = discProfileData[key];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${key}:`, MARGIN, y + barHeight / 2 + 1);
    doc.text(`${pct}%`, MARGIN + labelWidth + barMaxWidth + 4, y + barHeight / 2 + 1);
    const [r, g, b] = hexToRgb(profile.hexColor);
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN + labelWidth, y, (barMaxWidth * pct) / 100, barHeight, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(MARGIN + labelWidth, y, barMaxWidth, barHeight, 'S');
    y += barHeight + 3;
  });
  y += SECTION_GAP;

  // Each dimension (label, description, traits)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Dimensões DISC', MARGIN, y);
  y += LINE_HEIGHT;

  DISC_KEYS.forEach((key) => {
    if (y > 250) {
      doc.addPage();
      y = MARGIN;
    }
    const profile = discProfileData[key];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${key} - ${profile.name}`, MARGIN, y);
    y += LINE_HEIGHT;
    doc.setFont('helvetica', 'normal');
    const dimDescLines = doc.splitTextToSize(profile.description, contentWidth);
    dimDescLines.forEach((line: string) => {
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    });
    doc.text(`Características: ${profile.traits.join(', ')}`, MARGIN, y);
    y += LINE_HEIGHT + 2;
  });

  y += SECTION_GAP;

  // Strengths (primary traits)
  if (y > 260) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Pontos fortes', MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  primary.traits.forEach((trait) => {
    doc.text(`• ${trait}`, MARGIN, y);
    y += LINE_HEIGHT;
  });
  y += SECTION_GAP;

  // Attention points
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Pontos de atenção', MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  const attention = discAttentionPoints[payload.primaryResult];
  attention.forEach((point) => {
    doc.text(`• ${point}`, MARGIN, y);
    y += LINE_HEIGHT;
  });
  y += SECTION_GAP;

  // Footer: date and evaluator
  const completedDate = payload.completedAt
    ? new Date(payload.completedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Data da avaliação: ${completedDate}`, MARGIN, y);
  y += LINE_HEIGHT;
  if (payload.evaluator) {
    doc.text(`Avaliador: ${payload.evaluator}`, MARGIN, y);
  }

  return doc.output('blob');
}
