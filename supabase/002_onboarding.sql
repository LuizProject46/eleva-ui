-- Onboarding module: templates, steps, tasks, assignments, progress
-- Run after 001_create_profiles.sql

-- Templates (RH configura)
CREATE TABLE onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steps (etapas do template)
CREATE TABLE onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (tarefas por etapa)
CREATE TABLE onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments (colaborador vinculado ao template)
CREATE TABLE onboarding_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- Progress (tarefa concluída)
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(profile_id, task_id)
);

CREATE INDEX idx_onboarding_progress_profile ON onboarding_progress(profile_id);
CREATE INDEX idx_onboarding_steps_template ON onboarding_steps(template_id);
CREATE INDEX idx_onboarding_tasks_step ON onboarding_tasks(step_id);
CREATE INDEX idx_onboarding_assignments_profile ON onboarding_assignments(profile_id);

-- RLS
ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Templates: HR can manage, all can view
CREATE POLICY "Templates view all" ON onboarding_templates FOR SELECT USING (true);
CREATE POLICY "Templates HR manage" ON onboarding_templates FOR ALL USING (public.get_my_role() = 'hr');

-- Steps: same as templates
CREATE POLICY "Steps view all" ON onboarding_steps FOR SELECT USING (true);
CREATE POLICY "Steps HR manage" ON onboarding_steps FOR ALL USING (public.get_my_role() = 'hr');

-- Tasks: same
CREATE POLICY "Tasks view all" ON onboarding_tasks FOR SELECT USING (true);
CREATE POLICY "Tasks HR manage" ON onboarding_tasks FOR ALL USING (public.get_my_role() = 'hr');

-- Assignments: own or HR/Manager
CREATE POLICY "Assignments view own" ON onboarding_assignments FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Assignments view all" ON onboarding_assignments FOR SELECT USING (public.get_my_role() IN ('hr', 'manager'));
CREATE POLICY "Assignments HR manage" ON onboarding_assignments FOR ALL USING (public.get_my_role() = 'hr');

-- Progress: own can insert/update, HR/Manager can view
CREATE POLICY "Progress view own" ON onboarding_progress FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Progress view all" ON onboarding_progress FOR SELECT USING (public.get_my_role() IN ('hr', 'manager'));
CREATE POLICY "Progress insert own" ON onboarding_progress FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Progress delete own" ON onboarding_progress FOR DELETE USING (auth.uid() = profile_id);

-- Seed default template
INSERT INTO onboarding_templates (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Onboarding Padrão');

INSERT INTO onboarding_steps (id, template_id, "order", title, description) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 1, 'Documentação Inicial', 'Envio de documentos e preenchimento de formulários obrigatórios'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 2, 'Treinamento Institucional', 'Conhecer a cultura, valores e políticas da empresa'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 3, 'Conhecer a Equipe', 'Integração com colegas e liderança direta'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 4, 'Primeiro Projeto', 'Participação em uma atividade prática supervisionada');


INSERT INTO onboarding_tasks (step_id, "order", title) VALUES
  ('00000000-0000-0000-0000-000000000011', 1, 'Contrato de trabalho'),
  ('00000000-0000-0000-0000-000000000011', 2, 'Documentos pessoais'),
  ('00000000-0000-0000-0000-000000000011', 3, 'Dados bancários'),
  ('00000000-0000-0000-0000-000000000012', 1, 'Vídeo institucional'),
  ('00000000-0000-0000-0000-000000000012', 2, 'Código de conduta'),
  ('00000000-0000-0000-0000-000000000012', 3, 'Políticas de segurança'),
  ('00000000-0000-0000-0000-000000000013', 1, 'Reunião com gestor'),
  ('00000000-0000-0000-0000-000000000013', 2, 'Apresentação ao time'),
  ('00000000-0000-0000-0000-000000000013', 3, 'Café virtual com mentores'),
  ('00000000-0000-0000-0000-000000000014', 1, 'Definir projeto inicial'),
  ('00000000-0000-0000-0000-000000000014', 2, 'Acompanhamento semanal'),
  ('00000000-0000-0000-0000-000000000014', 3, 'Avaliação de conclusão');
