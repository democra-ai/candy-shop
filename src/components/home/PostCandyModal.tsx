import { useState, useEffect, useRef } from 'react';
import { Tag, Send, Terminal } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui/ModalShell';
import { LogoMark, getCandyIcon } from '../illustrations';
import { getFlavor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';
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

const inputClass =
  'w-full h-11 px-4 bg-input border border-input-border rounded-xl text-sm font-body text-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-border-hover ' +
  'transition-colors placeholder:text-foreground-tertiary';

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
  const isDark = useIsDark();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 50);
    } else {
      setName(''); setDescription(''); setCategory('Development');
      setTags(''); setInstallCommand(''); setSystemPrompt(''); setErrors({});
    }
  }, [isOpen]);

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

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      labelledById="post-candy-title"
      maxWidth="lg"
      padded={false}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <LogoMark size={28} />
        <div>
          <h2 id="post-candy-title" className="font-candy font-bold text-foreground text-lg">
            Post a Candy
          </h2>
          <p className="text-xs text-foreground-tertiary font-mono">Share your AI skill with the world</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Candy Name <span className="text-error">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
            placeholder="e.g. React Code Reviewer, SEO Content Generator"
            className={cn(inputClass, errors.name && 'border-error focus:ring-error/30')}
          />
          {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            What does it do? <span className="text-error">*</span>
          </label>
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
            placeholder="Describe what your AI skill can do, who it's for, and what makes it special."
            rows={3}
            className={cn(
              inputClass,
              'h-auto py-3 resize-none',
              errors.description && 'border-error focus:ring-error/30'
            )}
          />
          <div className="flex items-center justify-between mt-1">
            {errors.description
              ? <p className="text-xs text-error">{errors.description}</p>
              : <span />}
            <span className={cn('text-xs font-mono', description.length < 20 ? 'text-foreground-tertiary' : 'text-success')}>
              {description.length}/20 min
            </span>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map(c => {
              const Candy = getCandyIcon(c, isDark);
              const f = getFlavor(c, isDark);
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all btn-press',
                    active
                      ? 'bg-primary/10 text-primary border-primary/30 shadow-candy-1'
                      : 'bg-secondary/40 text-foreground-secondary border-border hover:bg-secondary hover:border-border-hover'
                  )}
                >
                  <Candy size={24} color={active ? undefined : f.base} />
                  <span>{c}</span>
                </button>
              );
            })}
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
            className={inputClass}
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
            className={cn(inputClass, 'h-auto py-3 font-mono resize-none')}
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
            className={cn(inputClass, 'font-mono')}
          />
        </div>
      </form>

      {/* Footer */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 rounded-2xl border border-border bg-card text-sm font-body font-medium text-foreground hover:border-border-hover hover:shadow-candy-1 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            'candy-btn btn-press flex-1 h-10 rounded-2xl text-sm font-body font-semibold',
            'flex items-center justify-center gap-2',
            submitting && 'opacity-70 cursor-not-allowed'
          )}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
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
    </ModalShell>
  );
}
