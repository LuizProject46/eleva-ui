import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const DEFAULT_DEPARTMENTS = [
  'Administrativo',
  'Comercial',
  'Financeiro',
  'Marketing',
  'Operações',
  'Recursos Humanos',
  'Tecnologia',
  'Vendas',
] as const;

export interface FiltersManagerOption {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface FiltersProps {
  filterName: string;
  filterEmail: string;
  filterPosition: string;
  filterDepartment: string;
  filterManager: string;
  filterActiveStatus: 'all' | 'active' | 'inactive';
  pageSize: number;
  managers: FiltersManagerOption[];
  showManagerFilter: boolean;
  pageSizeOptions: number[];
  onSearchFilterChange: (field: 'name' | 'email' | 'position', value: string) => void;
  onFilterDepartmentChange: (value: string) => void;
  onFilterManagerChange: (value: string) => void;
  onFilterActiveStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  onPageSizeChange: (value: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function Filters({
  filterName,
  filterEmail,
  filterPosition,
  filterDepartment,
  filterManager,
  filterActiveStatus,
  pageSize,
  managers,
  showManagerFilter,
  pageSizeOptions,
  onSearchFilterChange,
  onFilterDepartmentChange,
  onFilterManagerChange,
  onFilterActiveStatusChange,
  onPageSizeChange,
  onClearFilters,
  hasActiveFilters = false,
}: FiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftName, setDraftName] = useState(filterName);
  const [draftEmail, setDraftEmail] = useState(filterEmail);
  const [draftPosition, setDraftPosition] = useState(filterPosition);
  const [draftDepartment, setDraftDepartment] = useState(filterDepartment);
  const [draftManager, setDraftManager] = useState(filterManager);
  const [draftActiveStatus, setDraftActiveStatus] = useState(filterActiveStatus);

  useEffect(() => {
    if (sheetOpen) {
      setDraftName(filterName);
      setDraftEmail(filterEmail);
      setDraftPosition(filterPosition);
      setDraftDepartment(filterDepartment);
      setDraftManager(filterManager);
      setDraftActiveStatus(filterActiveStatus);
    }
  }, [sheetOpen, filterName, filterEmail, filterPosition, filterDepartment, filterManager, filterActiveStatus]);

  const handleApplyFilters = () => {
    onSearchFilterChange('name', draftName);
    onSearchFilterChange('email', draftEmail);
    onSearchFilterChange('position', draftPosition);
    onFilterDepartmentChange(draftDepartment);
    onFilterManagerChange(draftManager);
    onFilterActiveStatusChange(draftActiveStatus);
    setSheetOpen(false);
  };

  const handleClearInSheet = () => {
    setDraftName('');
    setDraftEmail('');
    setDraftPosition('');
    setDraftDepartment('all');
    setDraftManager('all');
    setDraftActiveStatus('all');
    onClearFilters?.();
    setSheetOpen(false);
  };

  const activeFiltersCount = [
    filterName.trim(),
    filterEmail.trim(),
    filterPosition.trim(),
  ].filter(Boolean).length +
    (filterDepartment !== 'all' ? 1 : 0) +
    (filterManager !== 'all' ? 1 : 0) +
    (filterActiveStatus !== 'all' ? 1 : 0);

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
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Nome</Label>
                <Input
                  placeholder="Buscar por nome..."
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">E-mail</Label>
                <Input
                  type="search"
                  placeholder="Buscar por e-mail..."
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Cargo</Label>
                <Input
                  placeholder="Buscar por cargo..."
                  value={draftPosition}
                  onChange={(e) => setDraftPosition(e.target.value)}
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Setor</Label>
                <Select value={draftDepartment} onValueChange={setDraftDepartment}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {DEFAULT_DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showManagerFilter && (
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">Gestor</Label>
                  <Select value={draftManager} onValueChange={setDraftManager}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Select value={draftActiveStatus} onValueChange={(v) => setDraftActiveStatus(v as 'all' | 'active' | 'inactive')}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handleApplyFilters} className="w-full gradient-hero hover:opacity-90">
                  Aplicar filtros
                </Button>
                {onClearFilters && hasActiveFilters && (
                  <Button variant='outline' onClick={handleClearInSheet} className="w-full justify-center  hover:opacity-90">
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
