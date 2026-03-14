/**
 * PDI lifecycle helpers: who can perform which status transitions.
 * Used to gate UI actions (buttons) in PdiDetail.
 */

import type { Pdi, PdiStatus } from '@/types/pdi';

export const PDI_STATUS_LABELS: Record<PdiStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  closed: 'Concluído',
  archived: 'Arquivado',
};

export function canActivatePdi(pdi: Pdi): boolean {
  return pdi.status === 'draft';
}

export function canClosePdi(pdi: Pdi): boolean {
  return pdi.status === 'active';
}

export function canArchivePdi(pdi: Pdi): boolean {
  return pdi.status === 'closed';
}

export function canTransitionTo(pdi: Pdi, newStatus: PdiStatus): boolean {
  switch (newStatus) {
    case 'active':
      return canActivatePdi(pdi);
    case 'closed':
      return canClosePdi(pdi);
    case 'archived':
      return canArchivePdi(pdi);
    default:
      return false;
  }
}
