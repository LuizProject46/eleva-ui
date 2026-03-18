import { memo } from 'react';

import type { PdiStatus } from '@/types/pdi';
import type { PdiProgressStatus } from '@/modules/pdi/utils/derivePdiStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const R = 20;
const STROKE = 3;
const SIZE = (R + STROKE) * 2;
const C = 2 * Math.PI * R;

const PROGRESS_LABELS: Record<PdiProgressStatus, string> = {
  completed: 'Plano concluído',
  overdue: 'Em atraso',
  in_progress: 'Em andamento',
};

interface PdiListProgressRingProps {
  pct: number;
  progressStatus: PdiProgressStatus;
  completed: number;
  total: number;
  pdiStatus: PdiStatus;
  /** Same label as the Status column badge (Rascunho, Ativo, etc.) */
  pdiStatusLabel: string;
}

function PdiListProgressRingInner({
  pct,
  progressStatus,
  completed,
  total,
  pdiStatus,
  pdiStatusLabel,
}: PdiListProgressRingProps) {
  const isFinished = pdiStatus === 'closed' || pdiStatus === 'archived';
  const displayPct = isFinished && total === 0 ? 100 : pct;
  const offset = C - (displayPct / 100) * C;

  let strokeClass = 'text-primary';
  if (progressStatus === 'overdue') {
    strokeClass = 'text-destructive';
  } else if (progressStatus === 'completed') {
    strokeClass = 'text-primary';
  } else {
    strokeClass = 'text-muted-foreground';
  }

  const centerLabel =
    total === 0
      ? isFinished
        ? '—'
        : '0%'
      : `${pct}%`;

  const centerTextClass =
    centerLabel.length >= 4
      ? 'text-[9px] sm:text-[10px]'
      : 'text-[10px] sm:text-[11px]';

  const ariaLabel =
    total === 0
      ? isFinished
        ? 'PDI encerrado'
        : 'Nenhuma tarefa cadastrada'
      : `${completed} de ${total} tarefas concluídas (${pct}%). ${PROGRESS_LABELS[progressStatus]}.`;

  const tooltipProgressLine = isFinished
    ? pdiStatus === 'archived'
      ? 'PDI arquivado.'
      : 'PDI encerrado.'
    : PROGRESS_LABELS[progressStatus];

  const tooltipTasksLine =
    total > 0 ? `${completed} de ${total} tarefas concluídas` : 'Nenhuma tarefa cadastrada';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={ariaLabel}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="absolute inset-0"
            aria-hidden
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              className="text-muted-foreground/25"
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeLinecap="round"
              className={strokeClass}
              style={{
                strokeDasharray: C,
                strokeDashoffset: offset,
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
              }}
            />
          </svg>
          <span
            className={`pointer-events-none relative z-10 font-semibold tabular-nums leading-none text-foreground ${centerTextClass}`}
          >
            {centerLabel}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-1 px-3 py-2">
        <p className="text-sm font-medium text-foreground">{pdiStatusLabel}</p>
        <p className="text-xs text-muted-foreground">{tooltipProgressLine}</p>
        <p className="text-xs text-muted-foreground">{tooltipTasksLine}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const PdiListProgressRing = memo(PdiListProgressRingInner);
