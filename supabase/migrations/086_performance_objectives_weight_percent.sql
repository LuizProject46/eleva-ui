-- Migration 086: Objective weights as integer percent (1–100) per row; all rows per employee sum to 100%.
-- Rebalances existing data; replaces CHECK; renormalize-on-delete runs before sum assert (trigger names order).

-- Shared idea: n objectives each get at least 1%; remaining (100 - n) points split by largest remainder from
-- proportional shares of (100-n) * item_weight / sum(item_weight).

-- ---------------------------------------------------------------------------
-- 1) One-time rebalance: per (tenant_id, employee_id), integer weights sum 100, each >= 1
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  grp RECORD;
BEGIN
  FOR grp IN
    SELECT DISTINCT tenant_id, employee_id
    FROM public.performance_objectives
  LOOP
    PERFORM set_config('app.renormalizing', 'true', true);

    IF (
      SELECT COUNT(*)::int
      FROM public.performance_objectives
      WHERE tenant_id = grp.tenant_id AND employee_id = grp.employee_id
    ) = 1 THEN
      UPDATE public.performance_objectives
      SET item_weight = 100
      WHERE tenant_id = grp.tenant_id AND employee_id = grp.employee_id;
    ELSE
      UPDATE public.performance_objectives po
      SET item_weight = calc.new_weight
      FROM (
        WITH po_grp AS (
          SELECT
            id,
            item_weight,
            sort_order,
            COUNT(*) OVER ()::int AS n,
            SUM(item_weight) OVER () AS grp_sum
          FROM public.performance_objectives
          WHERE tenant_id = grp.tenant_id AND employee_id = grp.employee_id
        ),
        alloc AS (
          SELECT
            id,
            sort_order,
            n,
            GREATEST(grp_sum, 0.0001) AS s,
            (100 - n)::numeric * item_weight / GREATEST(grp_sum, 0.0001) AS share_extra
          FROM po_grp
        ),
        floored AS (
          SELECT
            id,
            sort_order,
            n,
            (1 + FLOOR(share_extra))::int AS fl,
            share_extra - FLOOR(share_extra) AS frac
          FROM alloc
        ),
        rem AS (
          SELECT GREATEST(0, 100 - COALESCE(SUM(fl), 0))::int AS remainder_needed
          FROM floored
        ),
        numbered AS (
          SELECT
            f.id,
            f.fl,
            ROW_NUMBER() OVER (ORDER BY f.frac DESC, f.sort_order, f.id) AS rn,
            (SELECT remainder_needed FROM rem) AS rem
          FROM floored f
        )
        SELECT id, (fl + CASE WHEN rn <= rem THEN 1 ELSE 0 END)::numeric AS new_weight
        FROM numbered
      ) calc
      WHERE po.id = calc.id;
    END IF;

    PERFORM set_config('app.renormalizing', '', true);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Replace column constraint (integer percent 1–100)
-- ---------------------------------------------------------------------------
ALTER TABLE public.performance_objectives
  DROP CONSTRAINT IF EXISTS performance_objectives_item_weight_positive;

ALTER TABLE public.performance_objectives
  ADD CONSTRAINT performance_objectives_item_weight_percent CHECK (
    item_weight >= 1
    AND item_weight <= 100
    AND item_weight = FLOOR(item_weight)
  );

ALTER TABLE public.performance_objectives
  ALTER COLUMN item_weight SET DEFAULT 100;

COMMENT ON COLUMN public.performance_objectives.item_weight IS
  'Allocation percent for this objective among all objectives for the employee (integer 1–100; all rows for same employee sum to 100).';

COMMENT ON TABLE public.performance_objectives IS
  'Manager-scoped objectives per collaborator (max 5 per employee). item_weight is integer percent; sum per employee is 100. '
  'Weighted rating uses percent allocation with manager rating 1–3 per objective.';

-- ---------------------------------------------------------------------------
-- 3) Assert sum(item_weight) = 100 when at least one row exists (skip during renormalize)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.performance_objectives_assert_weights_sum100()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_employee_id uuid;
  v_count int;
  v_sum int;
BEGIN
  IF current_setting('app.renormalizing', true) IS NOT DISTINCT FROM 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_employee_id := OLD.employee_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_employee_id := NEW.employee_id;
  END IF;

  SELECT COUNT(*)::int, COALESCE(SUM(item_weight::numeric), 0)::int
  INTO v_count, v_sum
  FROM public.performance_objectives
  WHERE tenant_id = v_tenant_id AND employee_id = v_employee_id;

  IF v_count > 0 AND v_sum <> 100 THEN
    RAISE EXCEPTION
      'performance_objectives: weights for employee % must sum to 100%% (current total: %)',
      v_employee_id,
      v_sum;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.performance_objectives_renormalize_group(
  p_tenant_id uuid,
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_sum numeric;
BEGIN
  SELECT COUNT(*)::int INTO v_count
  FROM public.performance_objectives
  WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id;

  IF v_count = 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.renormalizing', 'true', true);

  IF v_count = 1 THEN
    UPDATE public.performance_objectives
    SET item_weight = 100
    WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id;
  ELSE
    SELECT COALESCE(SUM(item_weight), 0) INTO v_sum
    FROM public.performance_objectives
    WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id;

    IF v_sum <= 0 THEN
      v_sum := v_count::numeric;
    END IF;

    UPDATE public.performance_objectives po
    SET item_weight = calc.new_weight
    FROM (
      WITH po_grp AS (
        SELECT
          id,
          item_weight,
          sort_order,
          COUNT(*) OVER ()::int AS n,
          SUM(item_weight) OVER () AS grp_sum
        FROM public.performance_objectives
        WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id
      ),
      alloc AS (
        SELECT
          id,
          sort_order,
          n,
          GREATEST(grp_sum, 0.0001) AS s,
          (100 - n)::numeric * item_weight / GREATEST(grp_sum, 0.0001) AS share_extra
        FROM po_grp
      ),
      floored AS (
        SELECT
          id,
          sort_order,
          n,
          (1 + FLOOR(share_extra))::int AS fl,
          share_extra - FLOOR(share_extra) AS frac
        FROM alloc
      ),
      rem AS (
        SELECT GREATEST(0, 100 - COALESCE(SUM(fl), 0))::int AS remainder_needed
        FROM floored
      ),
      numbered AS (
        SELECT
          f.id,
          f.fl,
          ROW_NUMBER() OVER (ORDER BY f.frac DESC, f.sort_order, f.id) AS rn,
          (SELECT remainder_needed FROM rem) AS rem
        FROM floored f
      )
      SELECT id, (fl + CASE WHEN rn <= rem THEN 1 ELSE 0 END)::numeric AS new_weight
      FROM numbered
    ) calc
    WHERE po.id = calc.id;
  END IF;

  PERFORM set_config('app.renormalizing', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.performance_objectives_after_delete_renormalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.performance_objectives_renormalize_group(OLD.tenant_id, OLD.employee_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS performance_objectives_assert_weights_sum100_insert
  ON public.performance_objectives;
DROP TRIGGER IF EXISTS performance_objectives_assert_weights_sum100_update
  ON public.performance_objectives;
DROP TRIGGER IF EXISTS performance_objectives_assert_weights_sum100_delete
  ON public.performance_objectives;
DROP TRIGGER IF EXISTS performance_objectives_after_delete_renormalize
  ON public.performance_objectives;
DROP TRIGGER IF EXISTS performance_objectives_delete_step1_renormalize
  ON public.performance_objectives;
DROP TRIGGER IF EXISTS performance_objectives_delete_step2_assert_sum100
  ON public.performance_objectives;

-- step1 before step2 (alphabetical)
CREATE TRIGGER performance_objectives_delete_step1_renormalize
  AFTER DELETE ON public.performance_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_objectives_after_delete_renormalize();

CREATE TRIGGER performance_objectives_delete_step2_assert_sum100
  AFTER DELETE ON public.performance_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_objectives_assert_weights_sum100();

CREATE TRIGGER performance_objectives_assert_weights_sum100_insert
  AFTER INSERT ON public.performance_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_objectives_assert_weights_sum100();

CREATE TRIGGER performance_objectives_assert_weights_sum100_update
  AFTER UPDATE ON public.performance_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_objectives_assert_weights_sum100();
