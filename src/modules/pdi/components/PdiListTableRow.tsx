/**
 * Memoized table row for the PDI list grid. Reduces re-renders when unrelated
 * parent state changes (e.g. dialogs). Rows still update together when any PDF
 * download is active so all download buttons can disable correctly.
 */
import { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { UserAvatar } from '@/components/UserAvatar';
import { PDI_TYPE_LABELS } from '@/constants/pdiTypes';
import { PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';
import type { PdiListRow } from '@/types/pdi';
import type { PdiListProgressEntry } from '@/modules/pdi/hooks/usePdiListProgress';
import { PdiListProgressRing } from '@/modules/pdi/components/PdiListProgressRing';

export interface EmployeeProfileCell {
  name: string;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
}

export interface PdiListTableRowProps {
  pdi: PdiListRow;
  progressEntry: PdiListProgressEntry;
  isProgressLoading: boolean;
  showEmployeeColumn: boolean;
  employeeProfile: EmployeeProfileCell | undefined;
  isEmployeeColumnSkeleton: boolean;
  canCreatePdi: boolean;
  isRowDownloadingPdf: boolean;
  isAnyPdfDownloadActive: boolean;
  onDownloadPdf: (pdiId: string) => void;
}

function PdiListTableRowInner({
  pdi,
  progressEntry,
  isProgressLoading,
  showEmployeeColumn,
  employeeProfile,
  isEmployeeColumnSkeleton,
  canCreatePdi,
  isRowDownloadingPdf,
  isAnyPdfDownloadActive,
  onDownloadPdf,
}: PdiListTableRowProps) {
  const handleDownloadClick = useCallback(() => {
    onDownloadPdf(pdi.id);
  }, [onDownloadPdf, pdi.id]);

  const statusBadgeVariant =
    pdi.status === 'active'
      ? 'default'
      : pdi.status === 'draft'
        ? 'secondary'
        : 'outline';

  const pdiStatusLabel = PDI_STATUS_LABELS[pdi.status] ?? pdi.status;
  const titleDisplay = pdi.title ?? employeeProfile?.name ?? 'PDI';

  return (
    <TableRow>
      <TableCell className="font-medium">{titleDisplay}</TableCell>
      <TableCell>{PDI_TYPE_LABELS[pdi.type] ?? pdi.type}</TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant} className="font-normal whitespace-nowrap">
          {pdiStatusLabel}
        </Badge>
      </TableCell>
      <TableCell className="py-2">
        {isProgressLoading ? (
          <Skeleton className="h-[46px] w-[46px] rounded-full" aria-hidden />
        ) : (
          <PdiListProgressRing
            pct={progressEntry.pct}
            progressStatus={progressEntry.progressStatus}
            completed={progressEntry.completed}
            total={progressEntry.total}
            pdiStatus={pdi.status}
            pdiStatusLabel={pdiStatusLabel}
          />
        )}
      </TableCell>
      {showEmployeeColumn && (
        <TableCell>
          {isEmployeeColumnSkeleton ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarUrl={employeeProfile?.avatar_url}
                avatarThumbUrl={employeeProfile?.avatar_thumb_url}
                name={employeeProfile?.name ?? pdi.employee_id}
                size="sm"
              />
              <Link
                to={`/employees/${pdi.employee_id}`}
                className="text-primary hover:underline"
              >
                {employeeProfile?.name ?? pdi.employee_id}
              </Link>
            </div>
          )}
        </TableCell>
      )}
      <TableCell>{new Date(pdi.created_at).toLocaleDateString('pt-BR')}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/pdis/${pdi.id}`}>
              {canCreatePdi && (pdi.status === 'draft' || pdi.status === 'active') ? (
                <>
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Ver
                </>
              )}
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function progressPropsEqual(
  a: PdiListProgressEntry,
  b: PdiListProgressEntry
): boolean {
  return (
    a.pct === b.pct &&
    a.progressStatus === b.progressStatus &&
    a.completed === b.completed &&
    a.total === b.total
  );
}

function profileEqual(
  a: EmployeeProfileCell | undefined,
  b: EmployeeProfileCell | undefined
): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return (
    a.name === b.name &&
    a.avatar_url === b.avatar_url &&
    a.avatar_thumb_url === b.avatar_thumb_url
  );
}

export const PdiListTableRow = memo(PdiListTableRowInner, (prev, next) => {
  if (prev.pdi.id !== next.pdi.id) return false;
  if (prev.pdi.title !== next.pdi.title) return false;
  if (prev.pdi.employee_id !== next.pdi.employee_id) return false;
  if (prev.pdi.type !== next.pdi.type) return false;
  if (prev.pdi.status !== next.pdi.status) return false;
  if (prev.pdi.created_at !== next.pdi.created_at) return false;
  if (!progressPropsEqual(prev.progressEntry, next.progressEntry)) return false;
  if (prev.isProgressLoading !== next.isProgressLoading) return false;
  if (prev.showEmployeeColumn !== next.showEmployeeColumn) return false;
  if (prev.isEmployeeColumnSkeleton !== next.isEmployeeColumnSkeleton) return false;
  if (!profileEqual(prev.employeeProfile, next.employeeProfile)) return false;
  if (prev.canCreatePdi !== next.canCreatePdi) return false;
  if (prev.isRowDownloadingPdf !== next.isRowDownloadingPdf) return false;
  if (prev.isAnyPdfDownloadActive !== next.isAnyPdfDownloadActive) return false;
  if (prev.onDownloadPdf !== next.onDownloadPdf) return false;
  return true;
});
