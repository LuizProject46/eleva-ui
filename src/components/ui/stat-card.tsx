import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent';
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  variant = 'default',
  className 
}: StatCardProps) {
  return (
    <div className={cn(
      "card-interactive p-6",
      variant === 'primary' && "gradient-hero text-white border-0",
      variant === 'accent' && "gradient-accent text-white border-0",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            variant === 'default' ? "text-muted-foreground" : "text-white/80"
          )}>
            {title}
          </p>
          <p className={cn(
            "text-3xl font-display font-bold",
            variant === 'default' ? "text-foreground" : "text-white"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              "text-sm",
              variant === 'default' ? "text-muted-foreground" : "text-white/70"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-sm font-medium",
              trend.positive ? "text-primary" : "text-destructive",
              variant !== 'default' && "text-primary-foreground/90"
            )}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "p-3 rounded-xl",
            variant === 'default' ? "bg-primary/10 text-primary" : "bg-white/20 text-white"
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
