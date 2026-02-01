-- DISC behavioral assessment: questions, assessments, answers
-- Run after 001_create_profiles.sql

-- Questions (fixed for MVP)
CREATE TABLE disc_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order" INT NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assessments (profile being evaluated, evaluator, type)
CREATE TABLE disc_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluator_type TEXT NOT NULL CHECK (evaluator_type IN ('self', 'manager', 'hr')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, evaluator_id, evaluator_type)
);

-- Answers (per question)
CREATE TABLE disc_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES disc_assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES disc_questions(id) ON DELETE CASCADE,
  value TEXT NOT NULL CHECK (value IN ('D', 'I', 'S', 'C')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, question_id)
);

CREATE INDEX idx_disc_assessments_profile ON disc_assessments(profile_id);
CREATE INDEX idx_disc_assessments_evaluator ON disc_assessments(evaluator_id);
CREATE INDEX idx_disc_answers_assessment ON disc_answers(assessment_id);

-- RLS
ALTER TABLE disc_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disc_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE disc_answers ENABLE ROW LEVEL SECURITY;

-- Questions: all can view
CREATE POLICY "Questions view all" ON disc_questions FOR SELECT USING (true);

-- Assessments: own (profile or evaluator) can view; profile can insert self; manager/hr can insert
CREATE POLICY "Assessments view own profile" ON disc_assessments FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Assessments view evaluator" ON disc_assessments FOR SELECT USING (auth.uid() = evaluator_id);
CREATE POLICY "Assessments view all" ON disc_assessments FOR SELECT USING (public.get_my_role() IN ('hr', 'manager'));
CREATE POLICY "Assessments insert" ON disc_assessments FOR INSERT WITH CHECK (
  auth.uid() = evaluator_id AND (
    (evaluator_type = 'self' AND auth.uid() = profile_id) OR
    (evaluator_type IN ('manager', 'hr') AND public.get_my_role() IN ('manager', 'hr'))
  )
);
CREATE POLICY "Assessments update" ON disc_assessments FOR UPDATE USING (auth.uid() = evaluator_id);

-- Answers: through assessment
CREATE POLICY "Answers view" ON disc_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM disc_assessments a WHERE a.id = assessment_id AND (a.profile_id = auth.uid() OR a.evaluator_id = auth.uid() OR public.get_my_role() IN ('hr', 'manager')))
);
CREATE POLICY "Answers insert" ON disc_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM disc_assessments a WHERE a.id = assessment_id AND a.evaluator_id = auth.uid())
);
CREATE POLICY "Answers update" ON disc_answers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM disc_assessments a WHERE a.id = assessment_id AND a.evaluator_id = auth.uid())
);

-- Seed questions
INSERT INTO disc_questions (id, "order", text, options) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 'Em situações de trabalho, você prefere:', '[{"value":"D","text":"Tomar decisões rápidas e assumir o controle"},{"value":"I","text":"Interagir com pessoas e persuadir outros"},{"value":"S","text":"Manter a estabilidade e apoiar o time"},{"value":"C","text":"Analisar dados e seguir procedimentos"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 2, 'Quando surge um problema, sua primeira reação é:', '[{"value":"D","text":"Agir imediatamente para resolver"},{"value":"I","text":"Discutir com colegas e buscar ideias"},{"value":"S","text":"Avaliar o impacto nas pessoas envolvidas"},{"value":"C","text":"Coletar informações antes de decidir"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 3, 'Você se sente mais motivado quando:', '[{"value":"D","text":"Tem desafios e metas audaciosas"},{"value":"I","text":"Pode se expressar e receber reconhecimento"},{"value":"S","text":"Tem um ambiente harmonioso e previsível"},{"value":"C","text":"Pode trabalhar com precisão e qualidade"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000004', 4, 'Em reuniões de equipe, você geralmente:', '[{"value":"D","text":"Lidera a discussão e propõe soluções"},{"value":"I","text":"Anima o grupo e traz energia"},{"value":"S","text":"Ouve atentamente e busca consenso"},{"value":"C","text":"Faz perguntas detalhadas e analíticas"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000005', 5, 'Seu maior ponto forte no trabalho é:', '[{"value":"D","text":"Determinação e foco em resultados"},{"value":"I","text":"Comunicação e entusiasmo"},{"value":"S","text":"Paciência e confiabilidade"},{"value":"C","text":"Precisão e atenção aos detalhes"}]'::jsonb);
