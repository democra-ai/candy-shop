import { Loader2, FileText, Brain, Sparkles, CheckCircle } from 'lucide-react';
import type { AnalysisStatus } from '../../types/skill-creator';

interface AnalysisProgressProps {
  status: AnalysisStatus['status'];
  progress: number;
  currentFile?: string;
  message: string;
}

export function AnalysisProgress({
  status,
  progress,
  currentFile,
  message,
}: AnalysisProgressProps) {
  const steps = [
    { key: 'uploading', label: 'Upload Files', icon: FileText },
    { key: 'extracting', label: 'Extract Content', icon: FileText },
    { key: 'analyzing', label: 'AI Analysis', icon: Brain },
    { key: 'generating', label: 'Generate Skill', icon: Sparkles },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="relative pt-5">
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="absolute top-0 right-0 text-xs font-mono text-foreground-tertiary">{progress}%</div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStepIndex;
          const isComplete = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                  ${isActive ? 'bg-primary text-primary-foreground scale-110' : ''}
                  ${isComplete ? 'bg-accent text-card' : ''}
                  ${isPending ? 'bg-secondary text-foreground-tertiary' : ''}
                `}
              >
                {isComplete ? (
                  <CheckCircle className="w-6 h-6" />
                ) : isActive ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </div>
              <span
                className={`
                  text-xs font-medium text-center
                  ${isActive ? 'text-primary' : ''}
                  ${isComplete ? 'text-accent' : ''}
                  ${isPending ? 'text-foreground-tertiary' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      <div className="bg-secondary rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-1">{message}</p>
            {currentFile && (
              <p className="text-xs text-foreground-tertiary font-mono">Processing: {currentFile}</p>
            )}
          </div>
        </div>
      </div>

      {/* Fun Loading Messages */}
      <div className="text-center">
        <p className="text-xs text-foreground-tertiary italic">{getLoadingMessage(status)}</p>
      </div>
    </div>
  );
}

function getLoadingMessage(status: string): string {
  const messages: Record<string, string[]> = {
    uploading: ['Uploading your files to the cloud...', 'File upload in progress, please wait...'],
    extracting: [
      'Reading your file content...',
      'AI is understanding your documents...',
      'Extracting key information...',
    ],
    analyzing: [
      'AI is deeply analyzing your professional domain...',
      'Identifying your skills and experience...',
      'This may take a moment, please be patient...',
    ],
    generating: [
      'Customizing skill configuration for you...',
      'Generating your personal AI assistant...',
      'Almost done...',
    ],
  };

  const statusMessages = messages[status] || ['Processing...'];
  return statusMessages[Math.floor(Math.random() * statusMessages.length)];
}
