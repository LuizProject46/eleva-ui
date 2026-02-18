import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Search } from 'lucide-react';
import { getCertificateForVerification } from '@/services/certificateService';
import type { CertificateVerificationRow } from '@/types/courses';

function formatCompletionDate(value: string): string {
  try {
    return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function Verificar() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const [code, setCode] = useState(codeFromUrl);
  const [submittedCode, setSubmittedCode] = useState(codeFromUrl);
  const [certificate, setCertificate] = useState<CertificateVerificationRow | null | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCode(codeFromUrl);
    setSubmittedCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    if (!submittedCode.trim()) {
      setCertificate(undefined);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setCertificate(undefined);
    getCertificateForVerification(submittedCode)
      .then((data) => {
        if (!cancelled) setCertificate(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setCertificate(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submittedCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedCode(code.trim());
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Verificar certificado</CardTitle>
          <CardDescription>
            Digite o código do certificado para confirmar sua autenticidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certificate-code">Código do certificado</Label>
              <div className="flex gap-2">
                <Input
                  id="certificate-code"
                  type="text"
                  placeholder="Ex.: ELEVA-XXXXXXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono"
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <span className="animate-pulse">Verificando…</span>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Verificar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {submittedCode && !isLoading && (
            <>
              {certificate === null && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <XCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Código não encontrado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Não existe certificado com este código. Verifique se digitou corretamente.
                    </p>
                  </div>
                </div>
              )}
              {certificate && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-primary">Certificado válido</p>
                    <dl className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Nome: </span>
                        <span className="font-medium">{certificate.user_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Curso: </span>
                        <span className="font-medium">{certificate.course_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data de conclusão: </span>
                        <span className="font-medium">
                          {formatCompletionDate(certificate.completion_date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Código: </span>
                        <span className="font-mono">{certificate.certificate_code}</span>
                      </div>
                    </dl>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
