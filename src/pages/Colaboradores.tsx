import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth, UserRole } from '@/contexts/AuthContext';
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
import { Users, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
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
import { Filters } from '@/components/filters/Filters';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ROLE_LABELS: Record<string, string> = {
  hr: 'RH',
  manager: 'GESTOR',
  employee: 'COLABORADOR',
};

/** Áreas/setores padrão para filtro e formulários (sem chamada à API) */
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

/** Sentinel para Select Radix: valor vazio causa bug no click; deve ser uma opção válida */
const EMPTY_MANAGER_VALUE = '__none__';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  position: string | null;
  cost_center: string | null;
  manager_id: string | null;
  manager_name?: string;
  is_active: boolean;
}

interface Manager {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Colaboradores() {
  const { user, isHR, isManager, canManageUsers, canCreateUser, canEditUser, canChangeRoleAndStatus } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    position: '',
    department: '',
    cost_center: '',
    manager_id: '',
    role: 'employee'
  });
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    role: 'employee' as UserRole,
    manager_id: '',
    is_active: true,
    name: '',
    position: '',
    department: '',
  });
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const [debouncedPosition, setDebouncedPosition] = useState('');
  const [filterActiveStatus, setFilterActiveStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [deleteConfirmProfile, setDeleteConfirmProfile] = useState<Profile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName(filterName);
      setDebouncedEmail(filterEmail);
      setDebouncedPosition(filterPosition);
    }, 400);
    return () => clearTimeout(t);
  }, [filterName, filterEmail, filterPosition]);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'department' | 'position'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const PAGE_SIZE_OPTIONS = [10, 25, 50];

  const canManage = user?.role === 'hr' || user?.role === 'manager';
  const isManagerRole = user?.role === 'manager';

  const fetchProfiles = useCallback(async () => {
    if (!canManage) return;

    setLoading(true);
    let query = supabase
      .from('profiles')
      .select(
        'id, email, name, role, department, position, cost_center, manager_id, is_active, manager:profiles!manager_id(name)',
        { count: 'exact' }
      )
      .order(sortBy, { ascending: sortAsc });

    if (user?.id) {
      query = query.neq('id', user.id);
    }
    if (filterDepartment !== 'all') {
      query = query.eq('department', filterDepartment);
    }
    if (isManagerRole && user?.id) {
      query = query.eq('manager_id', user.id);
    }

    if (!isManagerRole && filterManager && filterManager !== 'all') {
      console.log('filterManager', filterManager);
      query = query.eq('manager_id', filterManager);
    }
    if (debouncedName.trim()) {
      query = query.ilike('name', `%${debouncedName.trim()}%`);
    }
    if (debouncedEmail.trim()) {
      query = query.ilike('email', `%${debouncedEmail.trim()}%`);
    }
    if (debouncedPosition.trim()) {
      query = query.ilike('position', `%${debouncedPosition.trim()}%`);
    }
    if (filterActiveStatus === 'active') {
      query = query.eq('is_active', true);
    } else if (filterActiveStatus === 'inactive') {
      query = query.eq('is_active', false);
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

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
          is_active: (p as { is_active?: boolean }).is_active !== false,
        } as Profile;
      })
    );
    setLoading(false);
  }, [canManage, isManagerRole, page, pageSize, filterDepartment, filterManager, debouncedName, debouncedEmail, debouncedPosition, filterActiveStatus, sortBy, sortAsc, user?.id]);

  const fetchManagers = useCallback(async () => {
    if (!canManage) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('role', 'manager')
      .order('name');

    setManagers(data ?? []);
  }, [canManage]);

  // Managers list: fetch once on mount (or when permission changes), not on every filter/page change
  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  // Profiles: refetch only when filters, page, sort or pageSize actually change (stable deps)
  useEffect(() => {
    if (!canManage) return;
    fetchProfiles();
  }, [canManage, fetchProfiles]);

  const handleFilterDepartmentChange = (value: string) => {
    setFilterDepartment(value);
    setPage(1);
  };

  const handleFilterManagerChange = (value: string) => {
    setFilterManager(value);
    setPage(1);
  };

  const handleSearchFilterChange = (field: 'name' | 'email' | 'position', value: string) => {
    if (field === 'name') setFilterName(value);
    else if (field === 'email') setFilterEmail(value);
    else setFilterPosition(value);
    setPage(1);
  };

  const handleFilterActiveStatusChange = (value: string) => {
    setFilterActiveStatus(value as 'all' | 'active' | 'inactive');
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilterName('');
    setFilterEmail('');
    setFilterPosition('');
    setFilterDepartment('all');
    setFilterManager('all');
    setFilterActiveStatus('all');
    setPage(1);
  };

  const hasActiveFilters =
    filterName !== '' ||
    filterEmail !== '' ||
    filterPosition !== '' ||
    filterDepartment !== 'all' ||
    filterManager !== 'all' ||
    filterActiveStatus !== 'all';

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const handleDeleteUser = async () => {
    const profileToDelete = deleteConfirmProfile;
    if (!profileToDelete) return;

    setDeletingId(profileToDelete.id);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setDeleteConfirmProfile(null);
        setDeletingId(null);
        return;
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${baseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: profileToDelete.id }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? 'Erro ao excluir colaborador.');
        setDeleteConfirmProfile(null);
        setDeletingId(null);
        return;
      }
      if (data.error) {
        toast.error(data.error);
        setDeleteConfirmProfile(null);
        setDeletingId(null);
        return;
      }

      toast.success('Colaborador excluído.');
      setDeleteConfirmProfile(null);
      fetchProfiles();
    } catch {
      toast.error('Erro ao excluir colaborador. Tente novamente.');
    }
    setDeletingId(null);
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
    if (!form.name || !form.email || !form.position || !form.department) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (form.role === 'employee' && !form.manager_id) {
      toast.error('Gestor/equipe é obrigatório para colaborador');
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
          manager_id: form.manager_id || undefined,
          role: form.role,
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

      if (data?.emailPending && data?.message) {
        toast.success(data.message);
      } else {
        toast.success(`Convite enviado para ${form.email}`);
      }
      setModalOpen(false);
      setForm({ name: '', email: '', position: '', department: '', cost_center: '', manager_id: '', role: 'employee' });
      fetchProfiles();
    } catch (err) {
      toast.error('Erro ao enviar convite. Tente novamente.');
    }
    setSubmitting(false);
  };

  const openEditModal = (p: Profile) => {
    setEditingProfile(p);
    setEditForm({
      role: p.role,
      manager_id: p.manager_id ?? '',
      is_active: p.is_active !== false,
      name: p.name ?? '',
      position: p.position ?? '',
      department: p.department ?? '',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    if (canChangeRoleAndStatus()) {
      if (!editForm.manager_id && editForm.role === 'employee') {
        toast.error('Gestor/equipe é obrigatório para colaborador');
        return;
      }
    } else {
      if (editingProfile.role === 'employee' && !editForm.manager_id) {
        toast.error('Selecione o gestor/equipe para o colaborador');
        return;
      }
    }

    setSubmitting(true);
    try {
      const updates: Partial<Profile> & { is_active?: boolean } = {
        manager_id: editForm.manager_id || null,
      };
      if (canChangeRoleAndStatus()) {
        updates.role = editForm.role;
        updates.is_active = editForm.is_active;
        updates.name = editForm.name;
        updates.position = editForm.position || null;
        updates.department = editForm.department || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', editingProfile.id);

      if (error) throw error;
      toast.success('Perfil atualizado');
      setEditModalOpen(false);
      setEditingProfile(null);
      fetchProfiles();
    } catch (err) {
      toast.error('Erro ao atualizar perfil');
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
          {canCreateUser() && (
            <Button
              onClick={() => {
                setForm({
                  name: '',
                  email: '',
                  position: '',
                  department: '',
                  cost_center: '',
                  manager_id: !isHR() && user ? user.id : '',
                  role: 'employee',
                });
                setModalOpen(true);
              }}
              className="gradient-hero"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Colaborador
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Filters
            filterName={filterName}
            filterEmail={filterEmail}
            filterPosition={filterPosition}
            filterDepartment={filterDepartment}
            filterManager={filterManager}
            filterActiveStatus={filterActiveStatus}
            pageSize={pageSize}
            managers={managers}
            showManagerFilter={isHR()}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onSearchFilterChange={handleSearchFilterChange}
            onFilterDepartmentChange={handleFilterDepartmentChange}
            onFilterManagerChange={handleFilterManagerChange}
            onFilterActiveStatusChange={handleFilterActiveStatusChange}
            onPageSizeChange={handlePageSizeChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            /** Loading skeleton */
            <div className="overflow-x-auto">
              <div className="w-full min-w-0 rounded-lg border bg-background p-4">
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
            </div>
          ) : profiles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum colaborador encontrado</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
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
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
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
                        <TableCell>{ROLE_LABELS[p.role] ?? p.role}</TableCell>
                        <TableCell>{p.is_active !== false ? 'Ativo' : 'Inativo'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditUser(p) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(p)}
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isHR() && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmProfile(p)}
                                disabled={deletingId === p.id}
                                aria-label="Excluir"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
            {canCreateUser() && (
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as 'employee' | 'manager' | 'hr' }))}
                >
                  <SelectTrigger className="min-w-[200px]">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">{ROLE_LABELS.hr}</SelectItem>
                    <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                    <SelectItem value="employee">{ROLE_LABELS.employee}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <Label>Setor</Label>
              <Select
                value={form.department || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}
              >
                <SelectTrigger className="min-w-[200px]">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {canCreateUser() && (
              <div className="space-y-2">
                <Label>Gestor / Equipe</Label>
                <Select
                  value={form.manager_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, manager_id: v }))}
                  required={form.role === 'employee'}
                >
                  <SelectTrigger className="min-w-[200px]">
                    <SelectValue placeholder={form.role === 'hr' || form.role === 'manager' ? 'Opcional' : 'Selecione o gestor'} />
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

      <AlertDialog open={!!deleteConfirmProfile} onOpenChange={(open) => !open && setDeleteConfirmProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteConfirmProfile?.name}</strong> ({deleteConfirmProfile?.email})? Esta ação não pode ser desfeita e o usuário perderá o acesso à plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!!deletingId}
              onClick={handleDeleteUser}
            >
              {deletingId ? 'Excluindo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar colaborador</DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {canChangeRoleAndStatus() && (
                <>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input
                      value={editForm.position}
                      onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                      placeholder="Ex: Desenvolvedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Setor</Label>
                    <Select
                      value={editForm.department || undefined}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, department: v }))}
                    >
                      <SelectTrigger className="min-w-[200px]">
                        <SelectValue placeholder="Selecione o setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          new Set([
                            ...(editForm.department &&
                              !(DEFAULT_DEPARTMENTS as readonly string[]).includes(editForm.department)
                              ? [editForm.department]
                              : []),
                            ...DEFAULT_DEPARTMENTS,
                          ])
                        ).map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      value={editForm.role}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as 'employee' | 'manager' | 'hr' }))}
                    >
                      <SelectTrigger className="min-w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hr">{ROLE_LABELS.hr}</SelectItem>
                        <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                        <SelectItem value="employee">{ROLE_LABELS.employee}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editForm.is_active ? 'active' : 'inactive'}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, is_active: v === 'active' }))}
                    >
                      <SelectTrigger className="min-w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Gestor / Equipe</Label>
                <Select
                  value={
                    editForm.manager_id && managers.some((m) => m.id === editForm.manager_id)
                      ? editForm.manager_id
                      : EMPTY_MANAGER_VALUE
                  }
                  onValueChange={(v) =>
                    setEditForm((f) => ({ ...f, manager_id: v === EMPTY_MANAGER_VALUE ? '' : v }))
                  }
                  required={canChangeRoleAndStatus() ? editForm.role === 'employee' : editingProfile?.role === 'employee'}
                >
                  <SelectTrigger className="min-w-[200px]">
                    <SelectValue placeholder={editForm.role === 'manager' || editForm.role === 'hr' ? 'Opcional (gestor/RH não precisa)' : 'Selecione o gestor'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_MANAGER_VALUE}>—</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="gradient-hero">
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
