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
import { Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

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
  const { user, isHR, canManageUsers } = useAuth();
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

  const fetchProfiles = useCallback(async () => {
    if (!canManageUsers()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, department, position, cost_center, manager_id')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar colaboradores');
      setLoading(false);
      return;
    }

    const managerIds = [...new Set((data ?? []).map((p) => p.manager_id).filter(Boolean))] as string[];
    let managerNames: Record<string, string> = {};
    if (managerIds.length > 0) {
      const { data: managersData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', managerIds);
      managerNames = Object.fromEntries((managersData ?? []).map((m) => [m.id, m.name]));
    }

    setProfiles(
      (data ?? []).map((p) => ({
        ...p,
        manager_name: p.manager_id ? managerNames[p.manager_id] : undefined,
      }))
    );
    setLoading(false);
  }, [canManageUsers]);

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
    fetchManagers();
  }, [fetchProfiles, fetchManagers]);

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

  const filteredProfiles = profiles.filter((p) => {
    if (filterDepartment !== 'all' && p.department !== filterDepartment) return false;
    if (filterManager !== 'all' && p.manager_id !== filterManager) return false;
    return true;
  });

  const departments = [...new Set(profiles.map((p) => p.department).filter(Boolean))] as string[];

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

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Setor</Label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[180px]">
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
              <Select value={filterManager} onValueChange={setFilterManager}>
                <SelectTrigger className="w-[180px]">
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
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum colaborador encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => (
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
            <div className="space-y-2">
              <Label>Gestor</Label>
              <Select
                value={form.manager_id}
                onValueChange={(v) => setForm((f) => ({ ...f, manager_id: v }))}
                required
              >
                <SelectTrigger>
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
