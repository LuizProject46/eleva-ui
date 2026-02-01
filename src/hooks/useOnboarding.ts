import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// TODO: Migrar para API REST Laravel - escopo separado
// import api from '@/lib/api';

export interface OnboardingTask {
  id: string;
  step_id: string;
  order: number;
  title: string;
}

export interface OnboardingStep {
  id: string;
  template_id: string;
  order: number;
  title: string;
  description: string | null;
  tasks: OnboardingTask[];
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  steps: OnboardingStep[];
}

export interface OnboardingProgressItem {
  task_id: string;
  completed_at: string;
}

export interface EmployeeOnboardingProgress {
  id: string;
  name: string;
  email: string;
  template_name: string;
  completed_tasks: number;
  total_tasks: number;
  progress_percent: number;
}

async function fetchTemplateWithStepsAndTasks(templateId: string): Promise<OnboardingTemplate> {
  // TODO: Implementar chamada para API Laravel
  // const response = await api.get(`/api/onboarding/templates/${templateId}`);
  // return response.data;
  throw new Error('Onboarding API not implemented yet - migrate to Laravel');
}

export function useOnboarding(profileId?: string) {
  const queryClient = useQueryClient();

  const assignmentQuery = useQuery({
    queryKey: ['onboarding', 'assignment', profileId ?? 'current'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/onboarding/assignments/${profileId || 'me'}`);
      // return response.data;
      return null;
    },
    enabled: false, // Desabilitar até migração
  });

  const progressQuery = useQuery({
    queryKey: ['onboarding', 'progress', profileId ?? 'current'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/onboarding/progress/${profileId || 'me'}`);
      // return response.data;
      return [] as OnboardingProgressItem[];
    },
    enabled: false, // Desabilitar até migração
  });

  const templateQuery = useQuery({
    queryKey: ['onboarding', 'template', assignmentQuery.data?.template_id],
    queryFn: () => fetchTemplateWithStepsAndTasks(assignmentQuery.data!.template_id),
    enabled: !!assignmentQuery.data?.template_id,
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      // TODO: Implementar chamada para API Laravel
      // if (completed) {
      //   await api.post(`/api/onboarding/progress`, { task_id: taskId });
      // } else {
      //   await api.delete(`/api/onboarding/progress/${taskId}`);
      // }
      throw new Error('Onboarding API not implemented yet - migrate to Laravel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const assignmentForEmployee = assignmentQuery.data ?? null;
  const template = templateQuery.data ?? null;
  const progress = progressQuery.data ?? [];
  const completedTaskIds = new Set(progress.map((p) => p.task_id));

  const stepsWithProgress = (() => {
    if (!template?.steps) return [];
    let foundCurrent = false;
    return template.steps.map((step) => {
      const tasksWithCompleted = step.tasks.map((task) => ({
        ...task,
        completed: completedTaskIds.has(task.id),
      }));
      const allTasksCompleted = tasksWithCompleted.every((t) => t.completed);
      const isCurrent = !foundCurrent && !allTasksCompleted;
      if (isCurrent) foundCurrent = true;
      return {
        ...step,
        tasks: tasksWithCompleted,
        completed: allTasksCompleted,
        current: isCurrent,
      };
    });
  })();

  const totalTasks = template?.steps.reduce((acc, s) => acc + s.tasks.length, 0) ?? 0;
  const completedCount = progress.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return {
    assignment: assignmentForEmployee,
    template,
    steps: stepsWithProgress,
    progress,
    completedCount,
    totalTasks,
    progressPercent,
    isLoading: assignmentQuery.isLoading || (!!assignmentForEmployee && templateQuery.isLoading),
    toggleTask: toggleTaskMutation.mutate,
    isToggling: toggleTaskMutation.isPending,
    refetch: () => {
      assignmentQuery.refetch();
      progressQuery.refetch();
      templateQuery.refetch();
    },
  };
}

export function useTeamOnboarding() {
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: ['onboarding', 'team'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get('/api/onboarding/team');
      // return response.data;
      return [] as EmployeeOnboardingProgress[];
    },
    enabled: false, // Desabilitar até migração
  });

  return {
    employees: employeesQuery.data ?? [],
    isLoading: employeesQuery.isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['onboarding', 'team'] }),
  };
}

export function useAssignOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, templateId }: { profileId: string; templateId: string }) => {
      // TODO: Implementar chamada para API Laravel
      // await api.post('/api/onboarding/assignments', { profile_id: profileId, template_id: templateId });
      throw new Error('Onboarding API not implemented yet - migrate to Laravel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

export function useOnboardingTemplates() {
  return useQuery({
    queryKey: ['onboarding', 'templates'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get('/api/onboarding/templates');
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useEmployeesForAssign() {
  return useQuery({
    queryKey: ['profiles', 'employees'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get('/api/profiles?role=employee');
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}
