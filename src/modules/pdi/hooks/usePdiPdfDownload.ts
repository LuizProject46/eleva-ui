import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { buildPdiPdf, getPdiPdfFilename } from '@/lib/pdiPdf';
import type { PdiPdfPayload } from '@/lib/pdiPdf';
import {
  getPdi,
  listActionPlans,
  listPlanActionsByPdi,
} from '@/modules/pdi/services/pdiService';
import { derivePdiStatus } from '@/modules/pdi/utils/derivePdiStatus';
import { getCompletedCourseTitlesForPdiContext } from '@/modules/pdi/utils/pdiEmployeeCompletedCourses';
import { useBrand } from '@/contexts/BrandContext';

export function usePdiPdfDownload() {
  const { brand } = useBrand();
  const [downloadingPdiId, setDownloadingPdiId] = useState<string | null>(null);

  const downloadPdiPdf = useCallback(async (pdiId: string) => {
    setDownloadingPdiId(pdiId);
    try {
      const pdi = await getPdi(pdiId);
      if (!pdi) {
        toast.error('PDI não encontrado.');
        return;
      }
      const [plans, actions, profileResult, contextCourseTitles] = await Promise.all([
        listActionPlans(pdiId),
        listPlanActionsByPdi(pdiId),
        supabase.from('profiles').select('name').eq('id', pdi.employee_id).maybeSingle(),
        getCompletedCourseTitlesForPdiContext(pdi.employee_id),
      ]);
      const totalActions = actions.length;
      const completedActions = actions.filter((a) => a.completed).length;
      const progressPct =
        totalActions > 0 ? Math.round((100 * completedActions) / totalActions) : 0;
      const progressStatus = derivePdiStatus(pdi, actions, plans);
      const profileName = profileResult.data?.name;
      const employeeName =
        typeof profileName === 'string' ? profileName.trim() : '';

      const payload: PdiPdfPayload = {
        pdi,
        employeeName,
        actionPlans: plans,
        planActions: actions,
        progressStatus,
        completedActions,
        totalActions,
        progressPct,
        contextCourseTitles,
        generatedAt: new Date(),
        branding: {
          primaryColor: brand.primaryColor,
          accentColor: brand.accentColor,
          companyName: brand.companyName,
        },
      };

      const blob = buildPdiPdf(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getPdiPdfFilename(payload);
      link.rel = 'noopener';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF baixado com sucesso.');
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setDownloadingPdiId(null);
    }
  }, [brand.accentColor, brand.companyName, brand.primaryColor]);

  return {
    downloadPdiPdf,
    isDownloadingPdf: downloadingPdiId !== null,
    downloadingPdiId,
  };
}
