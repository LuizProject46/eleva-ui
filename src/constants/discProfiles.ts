/**
 * DISC profile data shared by Assessment UI and PDF report.
 * Tailwind color classes and icons are used only in the UI (Assessment.tsx).
 */

export type DiscKey = 'D' | 'I' | 'S' | 'C';

export interface DiscProfileData {
  name: string;
  description: string;
  traits: string[];
  /** Hex color for PDF bars (e.g. #ef4444) */
  hexColor: string;
}

export const DISC_KEYS: DiscKey[] = ['D', 'I', 'S', 'C'];

export const discProfileData: Record<DiscKey, DiscProfileData> = {
  D: {
    name: 'Dominância',
    description:
      'Você é movido por desafios e resultados. Tem facilidade para tomar decisões rápidas e liderar equipes em direção a objetivos claros.',
    traits: ['Direto', 'Decisivo', 'Orientado a resultados', 'Competitivo'],
    hexColor: '#ef4444',
  },
  I: {
    name: 'Influência',
    description:
      'Você tem excelentes habilidades interpessoais e consegue motivar e influenciar pessoas. Sua energia positiva contagia o ambiente.',
    traits: ['Entusiasta', 'Comunicativo', 'Persuasivo', 'Otimista'],
    hexColor: '#f59e0b',
  },
  S: {
    name: 'Estabilidade',
    description:
      'Você valoriza harmonia e consistência. É um excelente colaborador que contribui para um ambiente de trabalho estável e produtivo.',
    traits: ['Paciente', 'Confiável', 'Cooperativo', 'Bom ouvinte'],
    hexColor: '#10b981',
  },
  C: {
    name: 'Conformidade',
    description:
      'Você tem uma mente analítica e valoriza qualidade e precisão. Excelente em tarefas que exigem atenção aos detalhes e planejamento.',
    traits: ['Analítico', 'Preciso', 'Sistemático', 'Cauteloso'],
    hexColor: '#3b82f6',
  },
};

/** Attention points per dimension (weaker tendencies to be aware of) */
export const discAttentionPoints: Record<DiscKey, string[]> = {
  D: ['Pode impacientar-se com ritmos lentos', 'Pode parecer autoritário em excesso'],
  I: ['Pode perder foco em detalhes', 'Pode precisar de limites em prazos'],
  S: ['Pode resistir a mudanças bruscas', 'Pode evitar conflitos necessários'],
  C: ['Pode demorar em decisões', 'Pode priorizar processo em excesso'],
};
