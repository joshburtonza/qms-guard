import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  step: number;
  label: string;
  status: 'complete' | 'current' | 'pending';
}

interface WorkflowProgressProps {
  currentStep: number;
  className?: string;
}

const steps: Omit<WorkflowStep, 'status'>[] = [
  { step: 1, label: 'Initiated' },
  { step: 2, label: 'In Progress' },
  { step: 3, label: 'Review' },
  { step: 4, label: 'Verify' },
  { step: 5, label: 'Closed' },
];

export function WorkflowProgress({ currentStep, className }: WorkflowProgressProps) {
  const getStepStatus = (step: number): 'complete' | 'current' | 'pending' => {
    if (step < currentStep) return 'complete';
    if (step === currentStep) return 'current';
    return 'pending';
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const status = getStepStatus(step.step);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
                <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                  status === 'complete' && 'bg-accent border-accent text-accent-foreground',
                  status === 'current' && 'bg-foreground border-foreground text-background',
                  status === 'pending' && 'bg-muted border-border text-muted-foreground'
                )}
              >
                {status === 'complete' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-medium">{step.step}</span>
                )}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs font-medium text-center',
                  status === 'complete' && 'text-accent',
                  status === 'current' && 'text-foreground',
                  status === 'pending' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 mt-[-20px]',
                  status === 'complete' ? 'bg-accent' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
