import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPdiListMode,
  getPdiWriteCapabilities,
  type PdiListMode,
  type PdiWriteCapabilities,
} from '@/modules/pdi/pdiPermissions';

export interface PdiPermissions extends PdiWriteCapabilities {
  listMode: PdiListMode;
}

export function usePdiPermissions(): PdiPermissions {
  const { user } = useAuth();
  return useMemo(() => {
    const role = user?.role;
    return {
      listMode: getPdiListMode(role),
      ...getPdiWriteCapabilities(role),
    };
  }, [user?.role]);
}
