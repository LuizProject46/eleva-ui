-- Migration 007: Avaliações 360° e Notificações
-- Run after 001-006

-- Enum para tipo de avaliação
CREATE TYPE evaluation_type AS ENUM (
  'self',
  'manager_to_employee',
  'employee_to_manager',
  'hr_to_user',
  'direct_feedback'
);

-- Períodos de avaliação (rastreabilidade por semestre/ano)
CREATE TABLE evaluation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INT NOT NULL,
  semester INT CHECK (semester IN (1, 2)),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evaluation_periods_tenant ON evaluation_periods(tenant_id);
CREATE INDEX idx_evaluation_periods_year_semester ON evaluation_periods(tenant_id, year, semester);

-- Competências fixas (catálogo)
CREATE TABLE evaluation_competencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  "order" INT NOT NULL
);

-- Seed das 5 competências fixas
INSERT INTO evaluation_competencies (id, name, description, "order") VALUES
  ('foco_cliente', 'Foco no Cliente e Orientação a Resultados', 'Executar atividades com eficiência, produtividade e sustentabilidade, sempre com foco no cliente.', 1),
  ('melhoria_continua', 'Melhoria Contínua e Inovação', 'Questionar processos para gerar melhorias; Demonstrar curiosidade e buscar aprimorar o que já faz; Manter constância na busca pela qualidade do ambiente de trabalho.', 2),
  ('comprometimento', 'Comprometimento e Engajamento', 'Demonstrar comprometimento e oferecer suporte aos pares; Executar o trabalho com segurança, qualidade e foco na satisfação do cliente; Buscar aprendizado contínuo, autodesenvolvimento e oportunidades de crescimento para a empresa.', 3),
  ('trabalho_equipe', 'Trabalho em Equipe e Liderança', 'Criar um ambiente colaborativo baseado na confiança; Ser proativo nas atividades e no relacionamento com os pares.', 4),
  ('etica_responsabilidade', 'Ética e Responsabilidade', 'Agir com integridade, justiça e alinhamento aos valores da empresa.', 5)
ON CONFLICT (id) DO NOTHING;

-- Período padrão para tenant demo (desenvolvimento)
INSERT INTO evaluation_periods (tenant_id, name, year, semester, starts_at, ends_at)
SELECT id, '1º Semestre 2025', 2025, 1, '2025-01-01'::timestamptz, '2025-06-30'::timestamptz
FROM tenants WHERE slug = 'demo' LIMIT 1;

-- Avaliações
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_id UUID REFERENCES evaluation_periods(id) ON DELETE SET NULL,
  evaluator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluated_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type evaluation_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  overall_score NUMERIC(3,2),
  feedback_text TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evaluations_tenant ON evaluations(tenant_id);
CREATE INDEX idx_evaluations_evaluator ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_evaluated ON evaluations(evaluated_id);
CREATE INDEX idx_evaluations_period ON evaluations(period_id);
CREATE INDEX idx_evaluations_type ON evaluations(type);
CREATE INDEX idx_evaluations_submitted_at ON evaluations(submitted_at);

-- Scores por competência
CREATE TABLE evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES evaluation_competencies(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  UNIQUE(evaluation_id, competency_id)
);

CREATE INDEX idx_evaluation_scores_evaluation ON evaluation_scores(evaluation_id);

-- Notificações
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('evaluation_received', 'feedback_received')),
  title TEXT NOT NULL,
  body TEXT,
  related_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read_at);

-- RLS: evaluation_periods (leitura para tenant)
ALTER TABLE evaluation_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view evaluation_periods" ON evaluation_periods
  FOR SELECT USING (
    tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can manage evaluation_periods" ON evaluation_periods
  FOR ALL USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- RLS: evaluation_competencies (leitura pública - dados fixos)
ALTER TABLE evaluation_competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view evaluation_competencies" ON evaluation_competencies
  FOR SELECT USING (true);

-- RLS: evaluations (avaliador ou avaliado, mesmo tenant)
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see evaluations where evaluator or evaluated" ON evaluations
  FOR ALL USING (
    tenant_id = public.get_my_profile_tenant_id()
    AND (evaluator_id = auth.uid() OR evaluated_id = auth.uid())
  );

-- RLS: evaluation_scores (via evaluation - mesma regra)
ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see scores of visible evaluations" ON evaluation_scores
  FOR ALL USING (
    evaluation_id IN (
      SELECT id FROM evaluations
      WHERE tenant_id = public.get_my_profile_tenant_id()
      AND (evaluator_id = auth.uid() OR evaluated_id = auth.uid())
    )
  );

-- RLS: notifications (usuário vê só as suas)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- Função auxiliar para evitar recursão: retorna manager_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_my_manager_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT manager_id FROM public.profiles WHERE id = auth.uid() AND manager_id IS NOT NULL LIMIT 1;
$$;

-- Política adicional: colaborador pode ver perfil do gestor (para avaliar gestor)
CREATE POLICY "Users can view own manager" ON profiles
  FOR SELECT USING (id = public.get_my_manager_id());

-- Grants
GRANT SELECT ON evaluation_competencies TO anon, authenticated;
GRANT ALL ON evaluation_periods, evaluations, evaluation_scores, notifications TO authenticated;

-- Trigger para updated_at em evaluations
CREATE OR REPLACE FUNCTION update_evaluations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_evaluations_updated_at();

-- Habilitar Realtime para notificações (sino)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if realtime not available or table already added
END $$;
