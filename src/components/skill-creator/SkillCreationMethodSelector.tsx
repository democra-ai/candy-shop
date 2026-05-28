import { Upload, Edit3, Github, GitBranch, ArrowRight } from 'lucide-react';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';

interface SkillCreationMethodSelectorProps {
  onSelectMethod: (method: 'upload' | 'manual' | 'github' | 'workflow') => void;
}

export function SkillCreationMethodSelector({ onSelectMethod }: SkillCreationMethodSelectorProps) {
  const isDark = useIsDark();

  // Each method borrows a category shell so the cards feel like the rest of the
  // boutique (muted pastel surfaces, dark-aware) instead of generic white.
  const methods = [
    {
      id: 'workflow' as const,
      title: 'Visual Workflow Builder',
      description: 'Compose agent skills on a node-based canvas — wire up steps visually.',
      icon: GitBranch,
      shellKey: 'Design',
    },
    {
      id: 'upload' as const,
      title: 'Upload Files',
      description: 'Drop in your local files and let AI analyse them into a fresh skill.',
      icon: Upload,
      shellKey: 'Research',
    },
    {
      id: 'manual' as const,
      title: 'Manual Creation',
      description: 'Hand-craft a skill — enter the name, prompt and capabilities yourself.',
      icon: Edit3,
      shellKey: 'Development',
    },
    {
      id: 'github' as const,
      title: 'Import from GitHub',
      description: 'Pull a skill straight from a repo that ships a skill.md file.',
      icon: Github,
      shellKey: 'Tools',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-1.5">
          fresh batch
        </p>
        <h2 className="font-candy font-bold tracking-tight leading-[1.1] text-2xl md:text-3xl text-foreground">
          Choose a creation method
        </h2>
        <p className="mt-1.5 text-sm text-foreground-secondary">
          Pick how you'd like to make your new candy.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map((method) => {
          const Icon = method.icon;
          const f = getFlavor(method.shellKey, isDark);
          return (
            <button
              key={method.id}
              onClick={() => onSelectMethod(method.id)}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 text-left bg-card border border-border shadow-candy-1 candy-lift hover:shadow-candy-2 hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {/* thin flavor top accent */}
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: f.base }} aria-hidden />
              <span
                className="inline-flex w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: f.tint, color: f.base }}
              >
                <Icon className="w-5 h-5" />
              </span>

              <div className="space-y-1">
                <h3 className="font-candy font-bold text-base md:text-lg leading-[1.15] text-foreground">
                  {method.title}
                </h3>
                <p className="text-[13px] leading-snug font-body text-foreground-secondary">
                  {method.description}
                </p>
              </div>

              <span
                className="mt-auto inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider"
                style={{ color: f.base }}
              >
                get started
                <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
