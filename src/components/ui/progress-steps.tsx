import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  current?: boolean;
}

interface ProgressStepsProps {
  steps: Step[];
  className?: string;
}

export function ProgressSteps({ steps, className }: ProgressStepsProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full gradient-hero rounded-full transition-all duration-500 ease-out animate-progress"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={cn(
              "flex items-start gap-4 p-4 rounded-xl border transition-all duration-200",
              step.completed 
                ? "bg-primary/5 border-primary/20" 
                : step.current 
                  ? "bg-accent/5 border-accent/30 shadow-sm" 
                  : "bg-card border-border hover:border-muted-foreground/20"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200",
              step.completed 
                ? "gradient-hero text-white" 
                : step.current 
                  ? "gradient-accent text-white animate-pulse-soft" 
                  : "bg-muted text-muted-foreground"
            )}>
              {step.completed ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium",
                step.completed ? "text-primary" : step.current ? "text-accent-foreground" : "text-foreground"
              )}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              )}
            </div>
            {step.current && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-accent/20 text-accent">
                Em andamento
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
