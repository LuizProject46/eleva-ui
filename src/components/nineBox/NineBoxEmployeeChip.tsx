import type { MouseEvent } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

export interface NineBoxEmployeeChipProps {
  name: string;
  avatarUrl?: string | null;
  avatarThumbUrl?: string | null;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  tooltipTitle?: string;
}

function firstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return '—';
  return t.split(/\s+/)[0] ?? t;
}

export function NineBoxEmployeeChip({
  name,
  avatarUrl,
  avatarThumbUrl,
  onClick,
  className,
  tooltipTitle,
}: NineBoxEmployeeChipProps) {
  return (
    <button
      type="button"
      onClick={(e) => onClick?.(e)}
      title={tooltipTitle}
      className={cn(
        'flex items-center gap-1.5 min-w-0 max-w-full rounded-md border border-border/60 bg-background/90 px-1.5 py-1 text-left text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/80',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <UserAvatar
        avatarUrl={avatarUrl ?? undefined}
        avatarThumbUrl={avatarThumbUrl ?? undefined}
        name={name}
        size="sm"
        className="h-6 w-6 shrink-0 text-[10px]"
      />
      <span className="truncate">{firstName(name)}</span>
    </button>
  );
}
