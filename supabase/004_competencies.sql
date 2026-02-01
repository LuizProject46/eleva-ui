-- Competency evaluations: semiannual cycles, configurable competencies
-- Run after 001_create_profiles.sql

-- Cycles (ex: 1S2025)
CREATE TABLE competency_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competency items (configurable per cycle)
CREATE TABLE competency_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES competency_cycles(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluations (profile being evaluated, cycle, evaluator)
CREATE TABLE competency_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES competency_cycles(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  feedback_global TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, cycle_id, evaluator_id)
);

-- Scores per competency
CREATE TABLE competency_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES competency_evaluations(id) ON DELETE CASCADE,
  competency_item_id UUID NOT NULL REFERENCES competency_items(id) ON DELETE CASCADE,
  score INT CHECK (score >= 1 AND score <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evaluation_id, competency_item_id)
);

CREATE INDEX idx_competency_items_cycle ON competency_items(cycle_id);
CREATE INDEX idx_competency_evaluations_profile ON competency_evaluations(profile_id);
CREATE INDEX idx_competency_evaluations_cycle ON competency_evaluations(cycle_id);
CREATE INDEX idx_competency_scores_evaluation ON competency_scores(evaluation_id);

-- RLS
ALTER TABLE competency_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_scores ENABLE ROW LEVEL SECURITY;

-- Cycles: all can view, HR can manage
CREATE POLICY "Cycles view all" ON competency_cycles FOR SELECT USING (true);
CREATE POLICY "Cycles HR manage" ON competency_cycles FOR ALL USING (public.get_my_role() = 'hr');

-- Items: all can view, HR can manage
CREATE POLICY "Items view all" ON competency_items FOR SELECT USING (true);
CREATE POLICY "Items HR manage" ON competency_items FOR ALL USING (public.get_my_role() = 'hr');

-- Evaluations: own can view, evaluator can manage, HR/Manager can view all
CREATE POLICY "Evaluations view own" ON competency_evaluations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Evaluations view evaluator" ON competency_evaluations FOR SELECT USING (auth.uid() = evaluator_id);
CREATE POLICY "Evaluations view all" ON competency_evaluations FOR SELECT USING (public.get_my_role() IN ('hr', 'manager'));
CREATE POLICY "Evaluations insert evaluator" ON competency_evaluations FOR INSERT WITH CHECK (auth.uid() = evaluator_id);
CREATE POLICY "Evaluations update evaluator" ON competency_evaluations FOR UPDATE USING (auth.uid() = evaluator_id);

-- Scores: view for profile, evaluator, hr/manager; insert/update for evaluator
CREATE POLICY "Scores view" ON competency_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM competency_evaluations e WHERE e.id = evaluation_id AND (e.profile_id = auth.uid() OR e.evaluator_id = auth.uid() OR public.get_my_role() IN ('hr', 'manager'))
));
CREATE POLICY "Scores insert" ON competency_scores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM competency_evaluations e WHERE e.id = evaluation_id AND e.evaluator_id = auth.uid())
);
CREATE POLICY "Scores update" ON competency_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM competency_evaluations e WHERE e.id = evaluation_id AND e.evaluator_id = auth.uid())
);

-- Seed default cycle and competencies
INSERT INTO competency_cycles (id, name, start_date, end_date) VALUES
  ('00000000-0000-0000-0000-000000000001', '1º Semestre 2025', '2025-01-01', '2025-06-30');

INSERT INTO competency_items (cycle_id, "order", name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 'Qualidade do Trabalho', 'Precisão e atenção aos detalhes'),
  ('00000000-0000-0000-0000-000000000001', 2, 'Colaboração', 'Trabalho em equipe e comunicação'),
  ('00000000-0000-0000-0000-000000000001', 3, 'Proatividade', 'Iniciativa e antecipação de problemas'),
  ('00000000-0000-0000-0000-000000000001', 4, 'Cumprimento de Prazos', 'Entrega dentro do cronograma'),
  ('00000000-0000-0000-0000-000000000001', 5, 'Desenvolvimento Técnico', 'Crescimento de habilidades');
