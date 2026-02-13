import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
} as const;

export interface UserAvatarProps {
  avatarUrl?: string | null;
  avatarThumbUrl?: string | null;
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
  /** Use thumb for lists/sidebar; use standard (avatarUrl) for profile header */
  useThumb?: boolean;
}

export function UserAvatar({
  avatarUrl,
  avatarThumbUrl,
  name,
  size = 'md',
  className,
  useThumb = true,
}: UserAvatarProps) {
  const src = useThumb ? (avatarThumbUrl ?? avatarUrl) : (avatarUrl ?? avatarThumbUrl);
  const initials = getInitials(name);

  return (
    <Avatar className={cn(sizeClasses[size], 'shrink-0 rounded-full object-cover', className)}>
      {src ? (
        <AvatarImage src={src} alt={name} className="object-cover" loading="lazy" />
      ) : null}
      <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
    </Avatar>
  );
}
