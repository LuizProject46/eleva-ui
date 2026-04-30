-- RPC: insert a new objective when existing weights already sum to 100% by redistributing
-- existing rows in one transaction (uses app.renormalizing so sum assert does not fail mid-way).

CREATE OR REPLACE FUNCTION public.performance_objectives_insert_allocating(
  p_employee_id uuid,
  p_title text,
  p_description text,
  p_sort_order int,
  p_new_weight int
)
RETURNS public.performance_objectives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_role public.user_role;
  v_my_tenant uuid;
  v_emp_tenant uuid;
  v_emp_manager uuid;
  v_emp_role public.user_role;
  v_count int;
  v_sum int;
  s_target int;
  r public.performance_objectives;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: not authenticated';
  END IF;

  SELECT tenant_id, manager_id, role
  INTO v_emp_tenant, v_emp_manager, v_emp_role
  FROM public.profiles
  WHERE id = p_employee_id
  LIMIT 1;

  IF v_emp_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: employee not found';
  END IF;

  IF v_emp_role IS DISTINCT FROM 'employee'::public.user_role THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: objectives only for employees';
  END IF;

  SELECT role, tenant_id
  INTO v_my_role, v_my_tenant
  FROM public.profiles
  WHERE id = v_uid
  LIMIT 1;

  IF NOT (
    (v_my_role = 'hr' AND v_my_tenant = v_emp_tenant)
    OR (v_my_role = 'manager' AND v_my_tenant = v_emp_tenant AND v_emp_manager = v_uid)
  ) THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: permission denied';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: title required';
  END IF;

  IF p_new_weight < 1 OR p_new_weight > 100 OR p_new_weight::numeric <> floor(p_new_weight::numeric) THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: new weight must be integer 1–100';
  END IF;

  SELECT COUNT(*)::int, COALESCE(SUM(item_weight::numeric), 0)::int
  INTO v_count, v_sum
  FROM public.performance_objectives
  WHERE employee_id = p_employee_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'performance_objectives_insert_allocating: maximum 5 objectives';
  END IF;

  IF v_count = 0 THEN
    IF p_new_weight <> 100 THEN
      RAISE EXCEPTION 'performance_objectives_insert_allocating: first objective must be 100%%';
    END IF;
    INSERT INTO public.performance_objectives (
      employee_id,
      title,
      description,
      sort_order,
      item_weight
    )
    VALUES (
      p_employee_id,
      btrim(p_title),
      NULLIF(btrim(p_description), ''),
      p_sort_order,
      p_new_weight
    )
    RETURNING * INTO r;
    RETURN r;
  END IF;

  IF v_sum + p_new_weight = 100 THEN
    INSERT INTO public.performance_objectives (
      employee_id,
      title,
      description,
      sort_order,
      item_weight
    )
    VALUES (
      p_employee_id,
      btrim(p_title),
      NULLIF(btrim(p_description), ''),
      p_sort_order,
      p_new_weight
    )
    RETURNING * INTO r;
    RETURN r;
  END IF;

  IF v_sum <> 100 THEN
    RAISE EXCEPTION
      'performance_objectives_insert_allocating: existing total is % (expected 100 or room for new weight)',
      v_sum;
  END IF;

  s_target := 100 - p_new_weight;
  IF s_target < v_count THEN
    RAISE EXCEPTION
      'performance_objectives_insert_allocating: new weight % is too large (maximum allowed is % with % existing objectives)',
      p_new_weight,
      100 - v_count,
      v_count;
  END IF;

  PERFORM set_config('app.renormalizing', 'true', true);

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
      WHERE employee_id = p_employee_id
    ),
    alloc AS (
      SELECT
        id,
        sort_order,
        n,
        GREATEST(grp_sum, 0.0001) AS s,
        (s_target - n)::numeric * item_weight / GREATEST(grp_sum, 0.0001) AS share_extra
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
      SELECT GREATEST(0, s_target - COALESCE(SUM(fl), 0))::int AS remainder_needed
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

  INSERT INTO public.performance_objectives (
    employee_id,
    title,
    description,
    sort_order,
    item_weight
  )
  VALUES (
    p_employee_id,
    btrim(p_title),
    NULLIF(btrim(p_description), ''),
    p_sort_order,
    p_new_weight
  )
  RETURNING * INTO r;

  PERFORM set_config('app.renormalizing', '', true);

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.performance_objectives_insert_allocating(uuid, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.performance_objectives_insert_allocating(uuid, text, text, int, int) TO authenticated;

COMMENT ON FUNCTION public.performance_objectives_insert_allocating(uuid, text, text, int, int) IS
  'Inserts a performance objective; when existing weights sum to 100%%, redistributes them so the new row gets p_new_weight%% and the rest still sum to 100%%.';
