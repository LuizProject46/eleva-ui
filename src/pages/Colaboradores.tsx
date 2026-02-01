import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  position: string | null;
  cost_center: string | null;
  manager_id: string | null;
  manager_name?: string;
}

interface Manager {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Colaboradores() {
  const { user, isHR, isManager, canManageUsers } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    position: '',
    department: '',
    cost_center: '',
    manager_id: '',
  });
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'department' | 'position'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const PAGE_SIZE_OPTIONS = [10, 25, 50];

  const fetchDepartmentOptions = useCallback(async () => {
    if (!canManageUsers()) return;
    const { data } = await supabase
      .from('profiles')
      .select('department')
      .not('department', 'is', null)
      .limit(500);
    const unique = [...new Set((data ?? []).map((r) => r.department).filter(Boolean))] as string[];
    setDepartments(unique.sort());
  }, [canManageUsers]);

  const fetchProfiles = useCallback(async () => {
    if (!canManageUsers()) return;

    setLoading(true);
    let query = supabase
      .from('profiles')
      .select(
        'id, email, name, role, department, position, cost_center, manager_id, manager:profiles!manager_id(name)',
        { count: 'exact' }
      )
      .order(sortBy, { ascending: sortAsc })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filterDepartment !== 'all') {
      query = query.eq('department', filterDepartment);
    }
    if (filterManager !== 'all' || isManager()) {
      query = query.eq('manager_id', isManager() ? user?.id : filterManager);
    }

    const { data, error, count } = await query;

    if (error) {
      toast.error('Erro ao carregar colaboradores');
      setLoading(false);
      return;
    }

    setTotalCount(count ?? 0);
    setProfiles(
      (data ?? []).map((row: Record<string, unknown>) => {
        const { manager, ...p } = row;
        const m = Array.isArray(manager) ? manager[0] : manager;
        return {
          ...p,
          manager_name: (m as { name?: string })?.name,
        } as Profile;
      })
    );
    setLoading(false);
  }, [canManageUsers, page, pageSize, filterDepartment, filterManager, sortBy, sortAsc]);

  const fetchManagers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .in('role', ['manager', 'hr'])
      .order('name');

    const list = data ?? [];
    if (!isHR() && user) {
      setManagers(list.filter((m) => m.id === user.id));
    } else {
      setManagers(list);
    }
  }, [isHR, user]);

  useEffect(() => {
    fetchProfiles();
    fetchDepartmentOptions();
    fetchManagers();
  }, [fetchProfiles, fetchDepartmentOptions, fetchManagers]);

  const handleFilterDepartmentChange = (value: string) => {
    setFilterDepartment(value);
    setPage(1);
  };

  const handleFilterManagerChange = (value: string) => {
    setFilterManager(value);
    setPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const handleSort = (column: 'name' | 'email' | 'department' | 'position') => {
    if (sortBy === column) {
      setSortAsc((a) => !a);
    } else {
      setSortBy(column);
      setSortAsc(true);
    }
    setPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.position || !form.department || !form.manager_id) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('invite-employee', {
        body: {
          email: form.email,
          name: form.name,
          position: form.position,
          department: form.department,
          cost_center: form.cost_center || undefined,
          manager_id: form.manager_id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        setSubmitting(false);
        return;
      }

      toast.success(`Convite enviado para ${form.email}`);
      setModalOpen(false);
      setForm({ name: '', email: '', position: '', department: '', cost_center: '', manager_id: '' });
      fetchProfiles();
    } catch (err) {
      toast.error('Erro ao enviar convite');
    }
    setSubmitting(false);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  const SortIcon = ({ column }: { column: 'name' | 'email' | 'department' | 'position' }) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
    return sortAsc ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  if (!canManageUsers()) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isHR() ? 'Colaboradores' : 'Minha Equipe'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isHR()
                ? 'Gerencie os colaboradores da empresa'
                : 'Colaboradores sob sua gestão'}
            </p>
          </div>
          <Button
            onClick={() => {
              setForm({
                name: '',
                email: '',
                position: '',
                department: '',
                cost_center: '',
                manager_id: !isHR() && user ? user.id : '',
              });
              setModalOpen(true);
            }}
            className="gradient-hero"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Colaborador
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Setor</Label>
            <Select value={filterDepartment} onValueChange={handleFilterDepartmentChange}>
              <SelectTrigger className="w-[180px] min-w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isHR() && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Gestor</Label>
              <Select value={filterManager} onValueChange={handleFilterManagerChange}>
                <SelectTrigger className="w-[180px] min-w-[180px]">
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
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-sm text-muted-foreground">Por página</Label>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[80px] min-w-[80px]">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            /** Loading skeleton */
            <div className="w-full rounded-lg border bg-background p-4">
              <Table>
                {/* Header */}
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Skeleton className="h-4 w-24" />
                    </TableHead>
                    <TableHead>
                      <Skeleton className="h-4 w-40" />
                    </TableHead>
                    <TableHead>
                      <Skeleton className="h-4 w-28" />
                    </TableHead>
                    <TableHead>
                      <Skeleton className="h-4 w-24" />
                    </TableHead>
                    <TableHead className="text-right">
                      <Skeleton className="h-4 w-10 ml-auto" />
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {/* Body */}
                <TableBody>
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : profiles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum colaborador encontrado</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                      >
                        Nome
                        <SortIcon column="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort('email')}
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                      >
                        E-mail
                        <SortIcon column="email" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort('position')}
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                      >
                        Cargo
                        <SortIcon column="position" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort('department')}
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                      >
                        Setor
                        <SortIcon column="department" />
                      </button>
                    </TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Gestor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.position ?? '—'}</TableCell>
                      <TableCell>{p.department ?? '—'}</TableCell>
                      <TableCell>{p.cost_center ?? '—'}</TableCell>
                      <TableCell>{p.manager_name ?? '—'}</TableCell>
                      <TableCell>Ativo</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {startRow}–{endRow} de {totalCount}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage((p) => p - 1);
                        }}
                        className={page <= 1 || loading ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {(() => {
                      const maxVisible = 5;
                      let start = 1;
                      let end = Math.min(maxVisible, totalPages);
                      if (totalPages > maxVisible) {
                        if (page > totalPages - 2) {
                          start = totalPages - 4;
                          end = totalPages;
                        } else if (page > 2) {
                          start = page - 2;
                          end = page + 2;
                        }
                      }
                      return Array.from({ length: end - start + 1 }, (_, i) => {
                        const pageNum = start + i;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(pageNum);
                              }}
                              isActive={page === pageNum}
                              className={loading ? 'pointer-events-none' : ''}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      });
                    })()}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages) setPage((p) => p + 1);
                        }}
                        className={page >= totalPages || loading ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Colaborador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Cargo</Label>
              <Input
                id="position"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="Ex: Desenvolvedor"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Setor</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Ex: Tecnologia"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_center">Centro de Custo</Label>
              <Input
                id="cost_center"
                value={form.cost_center}
                onChange={(e) => setForm((f) => ({ ...f, cost_center: e.target.value }))}
                placeholder="Ex: CC-001"
              />
            </div>

            {isHR() && (
              <div className="space-y-2">
                <Label>Gestor</Label>
                <Select
                  value={form.manager_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, manager_id: v }))}
                  required
                >
                  <SelectTrigger className="min-w-[200px]">
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="gradient-hero">
                {submitting ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
