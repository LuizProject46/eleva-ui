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
import { ScrollArea } from '@/components/ui/scroll-area';
import { SlidersHorizontal } from 'lucide-react';

export interface CertificateFilterValues {
  courseName: string;
  completionDateFrom: string;
  completionDateTo: string;
  certificateCode: string;
}

export interface CertificateFiltersProps {
  courseName: string;
  completionDateFrom: string;
  completionDateTo: string;
  certificateCode: string;
  onApply: (values: CertificateFilterValues) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function CertificateFilters({
  courseName,
  completionDateFrom,
  completionDateTo,
  certificateCode,
  onApply,
  onClear,
  hasActiveFilters,
}: CertificateFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftCourseName, setDraftCourseName] = useState(courseName);
  const [draftCompletionDateFrom, setDraftCompletionDateFrom] = useState(completionDateFrom);
  const [draftCompletionDateTo, setDraftCompletionDateTo] = useState(completionDateTo);
  const [draftCertificateCode, setDraftCertificateCode] = useState(certificateCode);

  useEffect(() => {
    if (sheetOpen) {
      setDraftCourseName(courseName);
      setDraftCompletionDateFrom(completionDateFrom);
      setDraftCompletionDateTo(completionDateTo);
      setDraftCertificateCode(certificateCode);
    }
  }, [sheetOpen, courseName, completionDateFrom, completionDateTo, certificateCode]);

  const handleApply = () => {
    onApply({
      courseName: draftCourseName.trim(),
      completionDateFrom: draftCompletionDateFrom.trim(),
      completionDateTo: draftCompletionDateTo.trim(),
      certificateCode: draftCertificateCode.trim(),
    });
    setSheetOpen(false);
  };

  const handleClearInSheet = () => {
    setDraftCourseName('');
    setDraftCompletionDateFrom('');
    setDraftCompletionDateTo('');
    setDraftCertificateCode('');
    onClear();
    setSheetOpen(false);
  };

  const activeCount =
    (courseName ? 1 : 0) +
    (completionDateFrom ? 1 : 0) +
    (completionDateTo ? 1 : 0) +
    (certificateCode ? 1 : 0);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {hasActiveFilters && activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeCount > 99 ? '99+' : activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Curso</Label>
              <Input
                type="search"
                placeholder="Nome do curso..."
                value={draftCourseName}
                onChange={(e) => setDraftCourseName(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Data de conclusão (de)</Label>
              <Input
                type="date"
                value={draftCompletionDateFrom}
                onChange={(e) => setDraftCompletionDateFrom(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Data de conclusão (até)</Label>
              <Input
                type="date"
                value={draftCompletionDateTo}
                onChange={(e) => setDraftCompletionDateTo(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Código do certificado</Label>
              <Input
                type="search"
                placeholder="Ex.: código do certificado"
                value={draftCertificateCode}
                onChange={(e) => setDraftCertificateCode(e.target.value)}
                className="h-9 w-full font-mono text-sm"
              />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleApply} className="w-full gradient-hero hover:opacity-90">
                Aplicar filtros
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={handleClearInSheet}
                  className="w-full justify-center hover:opacity-90"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
