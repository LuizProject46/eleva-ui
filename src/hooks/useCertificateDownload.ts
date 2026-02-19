import { useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { buildCertificatePdf } from '@/lib/certificatePdf';
import type { CertificatePdfPayload, CertificateBranding } from '@/types/courses';
import {
  getCertificateById,
  getCertificateByAssignmentId,
  generateCertificateIfEligible,
} from '@/services/certificateService';
import { useBrand } from '@/contexts/BrandContext';

function getValidationUrl(code: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/verificar?code=${encodeURIComponent(code)}`;
  }
  return `https://example.com/verificar?code=${encodeURIComponent(code)}`;
}

function formatCompletionDate(completionDate: string): string {
  try {
    return new Date(completionDate + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return completionDate;
  }
}

/** Load image from URL and return as data URL for PDF embedding. */
async function imageUrlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const absoluteUrl =
      typeof window !== 'undefined' && url.startsWith('/')
        ? `${window.location.origin}${url}`
        : url;
    const res = await fetch(absoluteUrl, { mode: 'cors' });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function buildBranding(
  companyName: string,
  primaryColor: string,
  accentColor: string,
  logoUrl?: string
): Promise<CertificateBranding> {
  const logoDataUrl = logoUrl ? await imageUrlToDataUrl(logoUrl) : undefined;
  return {
    companyName,
    logoDataUrl,
    primaryColorHex: primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`,
    accentColorHex: accentColor.startsWith('#') ? accentColor : `#${accentColor}`,
  };
}

async function certificateToPayload(
  cert: {
    user_name: string;
    course_name: string;
    workload_hours: number | null;
    certificate_code: string;
    completion_date: string;
  },
  branding: CertificateBranding | null
): Promise<CertificatePdfPayload> {
  const validationUrl = getValidationUrl(cert.certificate_code);
  const qrDataUrl = await QRCode.toDataURL(validationUrl, {
    width: 256,
    margin: 1,
  });
  return {
    userName: cert.user_name,
    courseName: cert.course_name,
    workloadHours: cert.workload_hours,
    certificateCode: cert.certificate_code,
    completionDate: formatCompletionDate(cert.completion_date),
    validationUrl,
    qrDataUrl,
    branding: branding ?? undefined,
  };
}

export function useCertificateDownload() {
  const { brand } = useBrand();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);

  const downloadByCertificateId = useCallback(async (certificateId: string) => {
    setDownloadError(null);
    setDownloadingCertificateId(certificateId);
    setIsDownloading(true);

    try {
      const cert = await getCertificateById(certificateId);
      if (!cert) {
        toast.error('Certificado não encontrado.');
        setDownloadError('Certificado não encontrado');
        return;
      }
      const branding = await buildBranding(
        brand.companyName,
        brand.primaryColor,
        brand.accentColor,
        brand.logoUrl
      );
      const payload = await certificateToPayload(cert, branding);
      const blob = await buildCertificatePdf(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (cert.course_name || 'Certificado').replace(/[^a-zA-Z0-9\u00C0-\u00FF\s]/g, '');
      const dateStr = cert.completion_date.replace(/-/g, '');
      link.download = `Certificado-${safeName}-${dateStr}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Certificado baixado com sucesso.');
    } catch {
      toast.error('Não foi possível gerar o PDF do certificado.');
      setDownloadError('Erro ao gerar PDF');
    } finally {
      setIsDownloading(false);
      setDownloadingCertificateId(null);
    }
  }, [brand.companyName, brand.primaryColor, brand.accentColor, brand.logoUrl]);

  const downloadByAssignmentId = useCallback(async (assignmentId: string) => {
    setDownloadError(null);
    setDownloadingCertificateId(assignmentId);
    setIsDownloading(true);

    try {
      let cert = await getCertificateByAssignmentId(assignmentId);
      if (!cert) {
        cert = await generateCertificateIfEligible(assignmentId);
      }
      if (!cert) {
        toast.error('Certificado não disponível. Conclua o curso para gerar o certificado.');
        setDownloadError('Certificado não disponível');
        return;
      }
      const branding = await buildBranding(
        brand.companyName,
        brand.primaryColor,
        brand.accentColor,
        brand.logoUrl
      );
      const payload = await certificateToPayload(cert, branding);
      const blob = await buildCertificatePdf(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (cert.course_name || 'Certificado').replace(/[^a-zA-Z0-9\u00C0-\u00FF\s]/g, '');
      const dateStr = cert.completion_date.replace(/-/g, '');
      link.download = `Certificado-${safeName}-${dateStr}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Certificado baixado com sucesso.');
    } catch {
      toast.error('Não foi possível gerar o PDF do certificado.');
      setDownloadError('Erro ao gerar PDF');
    } finally {
      setIsDownloading(false);
      setDownloadingCertificateId(null);
    }
  }, [brand.companyName, brand.primaryColor, brand.accentColor, brand.logoUrl]);

  const downloadCertificate = useCallback(
    async (opts: { certificateId?: string; assignmentId?: string }) => {
      if (opts.certificateId) {
        await downloadByCertificateId(opts.certificateId);
        return;
      }
      if (opts.assignmentId) {
        await downloadByAssignmentId(opts.assignmentId);
        return;
      }
      toast.error('Informe o certificado ou a atribuição.');
    },
    [downloadByCertificateId, downloadByAssignmentId]
  );

  return {
    downloadCertificate,
    downloadByCertificateId,
    downloadByAssignmentId,
    isDownloading,
    downloadError,
    downloadingCertificateId,
  };
}
