import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { listMyCertificates } from '@/services/certificateService';
import { useCertificateDownload } from '@/hooks/useCertificateDownload';
import { CertificateFilters } from '@/components/filters/CertificateFilters';
import type { MyCertificateRow } from '@/types/courses';
import type { CertificateFilterValues } from '@/components/filters/CertificateFilters';

const PAGE_SIZE = 10;

function formatCompletionDate(value: string): string {
  try {
    return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function Certificates() {
  const [rows, setRows] = useState<MyCertificateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCourseName, setFilterCourseName] = useState('');
  const [filterCompletionDateFrom, setFilterCompletionDateFrom] = useState('');
  const [filterCompletionDateTo, setFilterCompletionDateTo] = useState('');
  const [filterCertificateCode, setFilterCertificateCode] = useState('');
  const { downloadByCertificateId, isDownloading, downloadingCertificateId } =
    useCertificateDownload();

  const fetchCertificates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, total: totalCount } = await listMyCertificates({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        filters: {
          courseName: filterCourseName || undefined,
          completionDateFrom: filterCompletionDateFrom || undefined,
          completionDateTo: filterCompletionDateTo || undefined,
          certificateCode: filterCertificateCode || undefined,
        },
      });
      setRows(data);
      setTotal(totalCount);
    } catch {
      toast.error('Erro ao carregar certificados.');
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    filterCourseName,
    filterCompletionDateFrom,
    filterCompletionDateTo,
    filterCertificateCode,
  ]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleApplyFilters = useCallback((values: CertificateFilterValues) => {
    setFilterCourseName(values.courseName);
    setFilterCompletionDateFrom(values.completionDateFrom);
    setFilterCompletionDateTo(values.completionDateTo);
    setFilterCertificateCode(values.certificateCode);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterCourseName('');
    setFilterCompletionDateFrom('');
    setFilterCompletionDateTo('');
    setFilterCertificateCode('');
    setPage(1);
  }, []);

  const hasActiveFilters =
    filterCourseName !== '' ||
    filterCompletionDateFrom !== '' ||
    filterCompletionDateTo !== '' ||
    filterCertificateCode !== '';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [page, totalPages]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in p-4 md:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Meus Certificados
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Certificados dos cursos que você concluiu. Baixe o PDF quando precisar.
          </p>
        </header>

        <Card>
          <CardHeader className="pb-4 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Award className="h-5 w-5" />
              </span>
              Certificados
            </CardTitle>
            <CardDescription>
              Lista dos seus certificados de conclusão. Cada PDF usa a identidade visual da sua empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CertificateFilters
                courseName={filterCourseName}
                completionDateFrom={filterCompletionDateFrom}
                completionDateTo={filterCompletionDateTo}
                certificateCode={filterCertificateCode}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
            <div className="rounded-lg border overflow-hidden">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
                    <Award className="h-7 w-7" />
                  </span>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Nenhum certificado ainda
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Conclua cursos para receber certificados. Eles aparecerão aqui para download.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-medium">Curso</TableHead>
                      <TableHead className="font-medium hidden sm:table-cell">Data de conclusão</TableHead>
                      <TableHead className="font-medium font-mono text-xs hidden md:table-cell">Código</TableHead>
                      <TableHead className="text-right w-[120px] sm:w-[140px] font-medium">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium align-top py-4">
                          <span className="block">{row.course_name}</span>
                          <span className="text-muted-foreground text-xs mt-0.5 sm:hidden">
                            {formatCompletionDate(row.completion_date)} · {row.certificate_code}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground align-top py-4 hidden sm:table-cell">
                          {formatCompletionDate(row.completion_date)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground align-top py-4 hidden md:table-cell">
                          {row.certificate_code}
                        </TableCell>
                        <TableCell className="text-right align-top py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full sm:w-auto"
                            onClick={() => downloadByCertificateId(row.id)}
                            disabled={isDownloading && downloadingCertificateId === row.id}
                          >
                            {isDownloading && downloadingCertificateId === row.id ? (
                              'Gerando…'
                            ) : (
                              <>
                                <Download className="h-4 w-4 shrink-0" />
                                Baixar PDF
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {!isLoading && rows.length > 0 && totalPages > 1 && (
              <nav
                className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2"
                aria-label="Navegação de páginas"
              >
                <p className="text-sm text-muted-foreground order-2 sm:order-1">
                  {total} certificado{total !== 1 ? 's' : ''} no total
                </p>
                <div className="flex items-center justify-center gap-1 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm text-muted-foreground min-w-[7rem] text-center">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </nav>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
