-- PDI - Individual Development Plan
-- Run after 001_create_profiles.sql

-- Plans (linked to employee)
CREATE TABLE idp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Objectives (goals within plan)
CREATE TABLE idp_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES idp_plans(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actions (tasks with deadlines)
CREATE TABLE idp_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES idp_objectives(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_idp_plans_profile ON idp_plans(profile_id);
CREATE INDEX idx_idp_objectives_plan ON idp_objectives(plan_id);
CREATE INDEX idx_idp_actions_objective ON idp_actions(objective_id);

-- RLS
ALTER TABLE idp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_actions ENABLE ROW LEVEL SECURITY;

-- Plans: profile can view own; creator, hr, manager can view all
CREATE POLICY "Plans view own" ON idp_plans FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Plans view all" ON idp_plans FOR SELECT USING (public.get_my_role() IN ('hr', 'manager'));
CREATE POLICY "Plans insert" ON idp_plans FOR INSERT WITH CHECK (
  public.get_my_role() IN ('hr', 'manager') OR auth.uid() = profile_id
);
CREATE POLICY "Plans update" ON idp_plans FOR UPDATE USING (
  auth.uid() = profile_id OR auth.uid() = created_by OR public.get_my_role() IN ('hr', 'manager')
);

-- Objectives: through plan
CREATE POLICY "Objectives view" ON idp_objectives FOR SELECT USING (
  EXISTS (SELECT 1 FROM idp_plans p WHERE p.id = plan_id AND (p.profile_id = auth.uid() OR p.created_by = auth.uid() OR public.get_my_role() IN ('hr', 'manager')))
);
CREATE POLICY "Objectives manage" ON idp_objectives FOR ALL USING (
  EXISTS (SELECT 1 FROM idp_plans p WHERE p.id = plan_id AND (p.profile_id = auth.uid() OR p.created_by = auth.uid() OR public.get_my_role() IN ('hr', 'manager')))
);

-- Actions: through objective -> plan
CREATE POLICY "Actions view" ON idp_actions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM idp_objectives o
    JOIN idp_plans p ON p.id = o.plan_id
    WHERE o.id = objective_id AND (p.profile_id = auth.uid() OR p.created_by = auth.uid() OR public.get_my_role() IN ('hr', 'manager'))
  )
);
CREATE POLICY "Actions manage" ON idp_actions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM idp_objectives o
    JOIN idp_plans p ON p.id = o.plan_id
    WHERE o.id = objective_id AND (p.profile_id = auth.uid() OR p.created_by = auth.uid() OR public.get_my_role() IN ('hr', 'manager'))
  )
);
