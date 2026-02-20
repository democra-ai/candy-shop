import { X, Copy, Check, Terminal, Play, Github, ExternalLink, FileText } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Skill } from '../../data/skillsData';
import { toast } from 'sonner';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface SkillModalProps {
  skill: Skill | null;
  onClose: () => void;
  onRun?: (skill: Skill) => void;
}

export function SkillModal({ skill, onClose, onRun }: SkillModalProps) {
  const [copied, setCopied] = useState(false);
  const [installCopied, setInstallCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, !!skill);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (skill) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [skill]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!skill) return null;

  const configString = JSON.stringify(skill.config, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(configString);
    setCopied(true);
    toast.success('Config copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(skill.installCommand);
    setInstallCopied(true);
    toast.success('Install command copied');
    setTimeout(() => setInstallCopied(false), 2000);
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${skill.name} details`}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-card rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-border">
        {/* Header */}
        <div
          className={`h-32 ${skill.color.replace('text-', 'bg-').replace('100', '50')} relative flex items-center justify-center`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 bg-white/50 hover:bg-white rounded-full transition-colors duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="text-6xl" aria-hidden="true">{skill.icon}</div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              {skill.category}
            </div>
            <div className="px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-bold border border-green-500/20">
              Ready to Serve
            </div>
          </div>

          <h2 className="text-3xl font-candy font-bold text-foreground mb-2">{skill.name}</h2>
          <p className="text-foreground-secondary text-lg mb-4 font-body leading-relaxed">
            {skill.description}
          </p>

          {skill.greeting && (
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Greeting:</p>
              <p className="text-foreground-secondary text-sm italic">"{skill.greeting}"</p>
            </div>
          )}

          {/* Install Command */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Quick Install
            </h3>
            <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm overflow-x-auto flex items-center justify-between group">
              <code className="break-all">{skill.installCommand}</code>
              <button
                onClick={handleCopyInstall}
                className="shrink-0 ml-2 p-2 hover:bg-white/10 rounded transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Copy install command"
              >
                {installCopied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          </div>

          {/* Source Links */}
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Source & Documentation
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`https://github.com/${skill.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-accent hover:border-primary/30 transition-all duration-200 cursor-pointer group"
              >
                <Github className="w-4 h-4 text-foreground-secondary group-hover:text-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">GitHub Repository</div>
                  <div className="text-sm font-medium text-foreground truncate">{skill.repo}</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </a>
              <a
                href={skill.skillMdUrl.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-accent hover:border-primary/30 transition-all duration-200 cursor-pointer group"
              >
                <FileText className="w-4 h-4 text-foreground-secondary group-hover:text-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Documentation</div>
                  <div className="text-sm font-medium text-foreground">SKILL.md</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </a>
            </div>
          </div>

          {/* Config JSON */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">Claude Desktop Config</h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-2 py-1"
                aria-label={copied ? 'Copied to clipboard' : 'Copy config to clipboard'}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Config'}
              </button>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-4 font-mono text-sm text-foreground-secondary overflow-auto max-h-64 shadow-inner">
              <pre>{configString}</pre>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-border bg-secondary/50 flex justify-end gap-3">
          <button
            onClick={() => {
              if (onRun && skill) {
                onRun(skill);
                onClose();
              }
            }}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors duration-200 shadow-lg flex items-center gap-2 cursor-pointer min-h-[40px] focus:outline-none focus:ring-2 focus:ring-green-500/50"
            aria-label={`Run ${skill.name}`}
          >
            <Play className="w-4 h-4" />
            Run Skill
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary-hover transition-colors duration-200 shadow-lg shadow-primary/20 cursor-pointer min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
