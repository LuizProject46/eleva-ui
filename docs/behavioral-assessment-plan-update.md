# Behavioral Assessment — Plan Update: Manager Can Take Assessment

**Change**: Manager can take the behavioral assessment (same as Employee and HR).

## Updated role matrix

| Role     | Can take assessment | Can see own status/result | Can see admin list        |
|----------|---------------------|---------------------------|----------------------------|
| Employee | Yes                 | Yes                       | No                         |
| HR       | Yes                 | Yes                       | Yes (all tenant)           |
| Manager  | **Yes**             | **Yes**                   | Yes (same dept/team only)  |

## Implementation impact

1. **Assessment.tsx**
   - **Manager**: Show both the assessment-taking view (intro / questions / result + own status) and the administrative view (same as HR). Do not restrict Manager to “admin only”.
   - **Employee**: Unchanged (take + own status only; no admin list).
   - **HR**: Unchanged (take + own status + admin list).

2. **Database / RLS**
   - Manager must be allowed to `INSERT` and `UPDATE` their **own** row in `behavioral_assessments` (same as Employee and HR). Only restrict Manager from writing other users’ rows.
   - Any view or RPC that lists “eligible users” for the admin list should include users with role in (`employee`, `hr`, `manager`), since all three can have an assessment.

3. **“Can take assessment” helper**
   - Use: `role === 'employee' || role === 'hr' || role === 'manager'` (all three can take).

All other aspects of the original plan (table shape, filters, pagination, HR vs Manager visibility) stay the same.
