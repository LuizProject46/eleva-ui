/**
 * Centralized evaluation permission rules: who can evaluate whom.
 * Single source of truth for form options and validation (frontend and mirrored in backend).
 */

export type UserRole = 'employee' | 'manager' | 'hr';

export type EvaluationType =
  | 'self'
  | 'manager_to_employee'
  | 'employee_to_manager'
  | 'hr_to_user'
  | 'direct_feedback';

/** Target roles that can be selected as "evaluated" for a given evaluator role and evaluation type */
export function getEligibleTargetRoles(
  evaluatorRole: UserRole,
  evaluationType: EvaluationType
): UserRole[] {
  if (evaluationType === 'self') return [evaluatorRole];
  if (evaluationType === 'manager_to_employee') {
    return evaluatorRole === 'manager' ? ['employee', 'hr'] : [];
  }
  if (evaluationType === 'employee_to_manager') {
    return evaluatorRole === 'employee' ? ['manager', 'hr'] : [];
  }
  if (evaluationType === 'hr_to_user') {
    return evaluatorRole === 'hr' ? ['employee', 'manager', 'hr'] : [];
  }
  if (evaluationType === 'direct_feedback') {
    if (evaluatorRole === 'manager') return ['employee', 'hr'];
    if (evaluatorRole === 'employee') return ['manager', 'hr'];
    if (evaluatorRole === 'hr') return ['employee', 'manager', 'hr'];
    return [];
  }
  return [];
}

/** Whether the evaluator role can see this evaluation type in the form */
export function canShowEvaluationType(
  role: UserRole,
  type: EvaluationType,
  context?: { managerId?: string | null }
): boolean {
  if (type === 'self') return true;
  if (type === 'employee_to_manager') return role === 'employee' && context?.managerId != null;
  if (type === 'manager_to_employee') return role === 'manager';
  if (type === 'hr_to_user') return role === 'hr';
  if (type === 'direct_feedback') return true;
  return false;
}

/** Whether this evaluator→evaluated combination is allowed for the given type */
export function canEvaluate(
  evaluatorRole: UserRole,
  evaluatedRole: UserRole,
  type: EvaluationType
): boolean {
  if (type === 'self') return evaluatorRole === evaluatedRole;
  const allowed = getEligibleTargetRoles(evaluatorRole, type);
  return allowed.includes(evaluatedRole);
}

/** Label for (type, targetRole) in the form type dropdown */
const FORM_TYPE_LABELS: Record<EvaluationType, Partial<Record<UserRole, string>>> = {
  self: { employee: 'Autoavaliação', manager: 'Autoavaliação', hr: 'Autoavaliação' },
  manager_to_employee: { employee: 'Gestor → Colaborador', hr: 'Gestor → RH' },
  employee_to_manager: { manager: 'Colaborador → Gestor', hr: 'Colaborador → RH' },
  hr_to_user: { employee: 'RH → Colaborador', manager: 'RH → Gestor', hr: 'RH → RH' },
  direct_feedback: {
    employee: 'Feedback direto → Colaborador',
    manager: 'Feedback direto → Gestor',
    hr: 'Feedback direto → RH',
  },
};

export interface FormTypeOption {
  type: EvaluationType;
  targetRole: UserRole;
  label: string;
  value: string;
}

/** Options for the "Tipo de avaliação" select: one per (type, targetRole) the user can choose. */
export function getFormTypeOptions(
  userRole: UserRole,
  context?: { managerId?: string | null }
): FormTypeOption[] {
  const types: EvaluationType[] = [
    'self',
    'employee_to_manager',
    'manager_to_employee',
    'hr_to_user',
    'direct_feedback',
  ];
  const options: FormTypeOption[] = [];
  for (const type of types) {
    if (!canShowEvaluationType(userRole, type, context)) continue;
    const targetRoles = getEligibleTargetRoles(userRole, type);
    for (const targetRole of targetRoles) {
      const label = type === 'self' ? 'Autoavaliação' : (FORM_TYPE_LABELS[type][targetRole] ?? `${type}:${targetRole}`);
      options.push({
        type,
        targetRole,
        label,
        value: `${type}:${targetRole}`,
      });
    }
  }
  return options;
}
