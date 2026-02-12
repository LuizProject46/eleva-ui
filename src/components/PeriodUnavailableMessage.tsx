import { CalendarClock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { PeriodStatus } from '@/lib/periodicity';

function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export type PeriodUnavailableVariant = 'outside_period' | 'already_completed';

export interface PeriodUnavailableMessageProps {
  entityLabel: string;
  periodStatus: PeriodStatus;
  currentPeriod: { periodStart: string; periodEnd: string } | null;
  nextPeriodStart: string | null;
  /** When 'already_completed', show message that the action was already done in this period; nextPeriodStart is used for next available date. */
  variant?: PeriodUnavailableVariant;
  className?: string;
}

export function PeriodUnavailableMessage({
  entityLabel,
  periodStatus,
  currentPeriod,
  nextPeriodStart,
  variant = 'outside_period',
  className,
}: PeriodUnavailableMessageProps) {
  if (variant === 'already_completed' && nextPeriodStart) {
    return (
      <Alert
        role="status"
        className={cn(
          'rounded-xl border-primary/20 bg-primary/5 text-foreground [&>svg]:text-primary',
          className
        )}
      >
        <CalendarClock className="h-5 w-5" />
        <AlertTitle className="mb-1 font-medium text-foreground">
          Já realizado neste período
        </AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground leading-relaxed">
          O próximo estará disponível em {formatDateBr(nextPeriodStart)}.
        </AlertDescription>
      </Alert>
    );
  }

  if (periodStatus === 'within') return null;

  let title: string;
  let description: string;
  if (periodStatus === 'before' && nextPeriodStart) {
    title = 'Fora do período de execução';
    description = `${entityLabel} estarão disponíveis a partir de ${formatDateBr(nextPeriodStart)}.`;
  } else if (periodStatus === 'after' && nextPeriodStart) {
    title = 'Período encerrado';
    description = `O próximo período terá início em ${formatDateBr(nextPeriodStart)}.`;
  } else {
    title = 'Indisponível no momento';
    description = `${entityLabel} não estão disponíveis. O RH pode configurar o período em Configurações.`;
  }

  return (
    <Alert
      role="status"
      className={cn(
        'rounded-xl border-primary/20 bg-primary/5 text-foreground [&>svg]:text-primary',
        className
      )}
    >
      <CalendarClock className="h-5 w-5" />
      <AlertTitle className="mb-1 font-medium text-foreground">{title}</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </AlertDescription>
    </Alert>
  );
}
