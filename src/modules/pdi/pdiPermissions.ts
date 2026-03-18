import type { UserRole } from '@/contexts/AuthContext';

export type PdiListMode = 'collaborator' | 'hr' | 'manager';

export interface PdiWriteCapabilities {
  canCreatePdi: boolean;
  canEditPdiContent: boolean;
  canEditActionPlans: boolean;
  canEditPlanActions: boolean;
  canArchiveClosedPdi: boolean;
}

export function getPdiWriteCapabilities(role: UserRole | undefined): PdiWriteCapabilities {
  const isManager = role === 'manager';
  return {
    canCreatePdi: isManager,
    canEditPdiContent: isManager,
    canEditActionPlans: isManager,
    canEditPlanActions: isManager,
    canArchiveClosedPdi: isManager,
  };
}

export function getPdiListMode(role: UserRole | undefined): PdiListMode {
  if (role === 'hr') return 'hr';
  if (role === 'manager') return 'manager';
  return 'collaborator';
}
