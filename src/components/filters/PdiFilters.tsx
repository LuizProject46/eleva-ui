import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SlidersHorizontal } from 'lucide-react';
import { AsyncSearchCombobox } from '@/components/async/AsyncSearchCombobox';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';
import { PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';

export interface PdiFiltersProps {
  filterEmployee: AsyncSearchOption | null;
  filterStatus: string;
  pageSize: number;
  pageSizeOptions: number[];
  showEmployeeFilter: boolean;
  onFilterEmployeeChange: (value: AsyncSearchOption | null) => void;
  onFilterStatusChange: (value: string) => void;
  onPageSizeChange: (value: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  onSearchEmployees: (query: string) => Promise<AsyncSearchOption[]>;
}

export function PdiFilters({
  filterEmployee,
  filterStatus,
  pageSize,
  pageSizeOptions,
  showEmployeeFilter,
  onFilterEmployeeChange,
  onFilterStatusChange,
  onPageSizeChange,
  onClearFilters,
  hasActiveFilters = false,
  onSearchEmployees,
}: PdiFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftEmployee, setDraftEmployee] = useState<AsyncSearchOption | null>(filterEmployee);
  const [draftStatus, setDraftStatus] = useState(filterStatus);

  useEffect(() => {
    if (sheetOpen) {
      setDraftEmployee(filterEmployee);
      setDraftStatus(filterStatus);
    }
  }, [sheetOpen, filterEmployee, filterStatus]);

  const handleApplyFilters = () => {
    onFilterEmployeeChange(draftEmployee);
    onFilterStatusChange(draftStatus);
    setSheetOpen(false);
  };

  const handleClearInSheet = () => {
    setDraftEmployee(null);
    setDraftStatus('all');
    onClearFilters?.();
    setSheetOpen(false);
  };

  const activeFiltersCount =
    (showEmployeeFilter && filterEmployee ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Aplicar filtros
            {hasActiveFilters && activeFiltersCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {activeFiltersCount > 99 ? '99+' : activeFiltersCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Aplicar Filtros</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-5 p-6">
              {showEmployeeFilter && (
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">Colaborador</Label>
                  <AsyncSearchCombobox
                    value={draftEmployee}
                    onValueChange={setDraftEmployee}
                    onSearch={onSearchEmployees}
                    placeholder="Todos"
                    searchPlaceholder="Buscar por nome..."
                    emptyMessage="Nenhum encontrado."
                    clearLabel="Limpar"
                    className="w-full"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Select value={draftStatus} onValueChange={setDraftStatus}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(PDI_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handleApplyFilters} className="w-full">
                  Aplicar filtros
                </Button>
                {onClearFilters && hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={handleClearInSheet}
                    className="w-full justify-center"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Por página</Label>
        <Select value={String(pageSize)} onValueChange={onPageSizeChange}>
          <SelectTrigger className="h-9 w-[80px]">
            <SelectValue placeholder="10" />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
