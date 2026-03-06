import { useState, useEffect, useRef } from 'react';
import { X, Tag, Send, Terminal } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Skill, SkillCategory } from '../../data/skillsData';

const CATEGORIES: SkillCategory[] = [
  'Development', 'Design', 'Marketing', 'Productivity',
  'Tools', 'Research', 'Mobile', 'Writing',
];

const CATEGORY_EMOJIS: Record<SkillCategory, string> = {
  Development: '💻', Design: '🎨', Marketing: '📣', Productivity: '⚡',
  Tools: '🔧', Research: '🔭', Mobile: '📱', Writing: '✍️',
};

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  Development: 'bg-blue-100 border-blue-200 text-blue-700',
  Design: 'bg-pink-100 border-pink-200 text-pink-700',
  Marketing: 'bg-orange-100 border-orange-200 text-orange-700',
  Productivity: 'bg-emerald-100 border-emerald-200 text-emerald-700',
  Tools: 'bg-violet-100 border-violet-200 text-violet-700',
  Research: 'bg-cyan-100 border-cyan-200 text-cyan-700',
  Mobile: 'bg-lime-100 border-lime-200 text-lime-700',
  Writing: 'bg-yellow-100 border-yellow-200 text-yellow-700',
};

interface PostCandyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (candy: Skill) => void;
}

export function PostCandyModal({ isOpen, onClose, onSubmit }: PostCandyModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('Development');
  const [tags, setTags] = useState('');
  const [installCommand, setInstallCommand] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 50);
    } else {
      setName(''); setDescription(''); setCategory('Development');
      setTags(''); setInstallCommand(''); setSystemPrompt(''); setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    else if (name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    if (!description.trim()) e.description = 'Description is required';
    else if (description.trim().length < 20) e.description = 'Please describe your candy in at least 20 characters';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const id = `user-candy-${Date.now()}`;

    const newCandy: Skill = {
      id,
      name: name.trim(),
      description: description.trim(),
      category,
      icon: CATEGORY_EMOJIS[category],
      color: CATEGORY_COLORS[category],
      installCommand: installCommand.trim() || `npx skills add community/${id}`,
      tags: tagList.length > 0 ? tagList : [category],
      popularity: 0,
      repo: '',
      skillMdUrl: '',
      config: systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {},
    };

    setTimeout(() => {
      onSubmit(newCandy);
      setSubmitting(false);
      onClose();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-candy-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass border border-border/50 rounded-2xl shadow-glass animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-candy-float">🍬</span>
            <div>
              <h2 id="post-candy-title" className="font-candy font-bold text-foreground text-lg">
                Post a Candy
              </h2>
              <p className="text-xs text-foreground-tertiary font-mono">Share your AI skill with the world</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Candy Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
              placeholder="e.g. React Code Reviewer, SEO Content Generator"
              className={cn(
                'w-full h-11 px-4 glass border rounded-xl text-sm font-body',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30',
                'transition-all placeholder:text-foreground-tertiary',
                errors.name ? 'border-red-400/50' : 'border-border/50'
              )}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              What does it do? <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
              placeholder="Describe what your AI skill can do, who it's for, and what makes it special."
              rows={3}
              className={cn(
                'w-full px-4 py-3 glass border rounded-xl text-sm font-body resize-none',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30',
                'transition-all placeholder:text-foreground-tertiary',
                errors.description ? 'border-red-400/50' : 'border-border/50'
              )}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.description
                ? <p className="text-xs text-red-400">{errors.description}</p>
                : <span />}
              <span className={cn('text-xs font-mono', description.length < 20 ? 'text-foreground-tertiary' : 'text-emerald-400')}>
                {description.length}/20 min
              </span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all btn-press',
                    category === c
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-secondary/20 text-foreground-tertiary border-border/30 hover:bg-secondary/40'
                  )}
                >
                  <span className="text-base">{CATEGORY_EMOJIS[c]}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              <Tag className="w-3.5 h-3.5 inline mr-1 text-foreground-tertiary" />
              Tags <span className="text-foreground-tertiary text-xs font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="React, TypeScript, AI, Automation"
              className="w-full h-11 px-4 glass border border-border/50 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-foreground-tertiary"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              System Prompt <span className="text-foreground-tertiary text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="You are an expert AI that helps with... (Define the behavior of your candy skill)"
              rows={3}
              className="w-full px-4 py-3 glass border border-border/50 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-foreground-tertiary"
            />
          </div>

          {/* Install Command */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              <Terminal className="w-3.5 h-3.5 inline mr-1 text-foreground-tertiary" />
              Install Command <span className="text-foreground-tertiary text-xs font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={installCommand}
              onChange={e => setInstallCommand(e.target.value)}
              placeholder="npx skills add your-org/your-skill"
              className="w-full h-11 px-4 glass border border-border/50 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-foreground-tertiary"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-border/50 text-sm font-body font-medium text-foreground-secondary hover:text-foreground hover:bg-secondary/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(
              'flex-1 h-10 rounded-xl text-sm font-body font-semibold transition-all btn-press',
              'bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-candy',
              'hover:shadow-candy-lg flex items-center justify-center gap-2',
              submitting && 'opacity-70 cursor-not-allowed'
            )}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Posting...
              </span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Post Candy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
