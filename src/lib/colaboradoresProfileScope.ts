/**
 * Base listing scope for “who appears in the collaborators list” — matches
 * {@link Colaboradores} `fetchProfiles` before optional UI filters (department,
 * manager dropdown for HR, name/email/position, active status, pagination).
 *
 * - **manager**: only direct reports (`manager_id` = current user) by default.
 * - **hr** / **employee**: no extra constraint here (HR sees tenant; employees use evaluation peer rules elsewhere).
 */
export function applyColaboradoresProfileListScope<
  T extends { eq(column: string, value: string): T },
>(
  query: T,
  userRole: string,
  scopeValue: string,
  scopeColumn: 'manager_id' | 'team_id' = 'manager_id'
): T {
  if (userRole === 'manager') {
    return query.eq(scopeColumn, scopeValue);
  }
  return query;
}
