import { useState, useEffect, useRef } from 'react';
import { X, Flame, Zap, Clock, DollarSign, Tag, Send } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Craving, CravingCategory, CravingUrgency } from '../../data/cravingsData';

const CATEGORIES: CravingCategory[] = [
  'Development', 'Design', 'Marketing', 'Productivity',
  'Tools', 'Research', 'Mobile', 'Writing',
];

const BUDGETS = ['Free', 'Under $50', '$50–150', '$150–400', '$400–1000', '$1000+', 'Open to offers'];

const CATEGORY_EMOJIS: Record<CravingCategory, string> = {
  Development: '💻', Design: '🎨', Marketing: '📣', Productivity: '⚡',
  Tools: '🔧', Research: '🔭', Mobile: '📱', Writing: '✍️',
};

interface PostCravingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (craving: Craving) => void;
}

export function PostCravingModal({ isOpen, onClose, onSubmit }: PostCravingModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CravingCategory>('Development');
  const [tags, setTags] = useState('');
  const [budget, setBudget] = useState('$50–150');
  const [urgency, setUrgency] = useState<CravingUrgency>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 50);
    } else {
      setTitle(''); setDescription(''); setCategory('Development');
      setTags(''); setBudget('$50–150'); setUrgency('medium'); setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    else if (title.trim().length < 10) e.title = 'Title must be at least 10 characters';
    if (!description.trim()) e.description = 'Description is required';
    else if (description.trim().length < 30) e.description = 'Please describe your craving in at least 30 characters';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const newCraving: Craving = {
      id: `user-craving-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      tags: tagList.length > 0 ? tagList : [category],
      budget,
      urgency,
      postedBy: 'You',
      postedAt: new Date().toISOString(),
      matchCount: 0,
      status: 'open',
      emoji: CATEGORY_EMOJIS[category],
    };

    setTimeout(() => {
      onSubmit(newCraving);
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
      aria-labelledby="post-craving-title"
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
            <span className="text-2xl">😋</span>
            <div>
              <h2 id="post-craving-title" className="font-candy font-bold text-foreground text-lg">
                Post a Craving
              </h2>
              <p className="text-xs text-foreground-tertiary font-mono">Tell agents what you need</p>
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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              What do you need? <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })); }}
              placeholder="e.g. Automated code review for my React monorepo"
              className={cn(
                'w-full h-11 px-4 glass border rounded-xl text-sm font-body',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30',
                'transition-all placeholder:text-foreground-tertiary',
                errors.title ? 'border-red-400/50' : 'border-border/50'
              )}
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Describe in detail <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
              placeholder="What exactly do you need? What are your requirements, constraints, and expected outputs?"
              rows={4}
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
              <span className={cn('text-xs font-mono', description.length < 30 ? 'text-foreground-tertiary' : 'text-emerald-400')}>
                {description.length}/30 min
              </span>
            </div>
          </div>

          {/* Category + Budget row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as CravingCategory)}
                className="w-full h-11 px-3 glass border border-border/50 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30 bg-transparent"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <DollarSign className="w-3.5 h-3.5 inline mr-1 text-foreground-tertiary" />
                Budget
              </label>
              <select
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="w-full h-11 px-3 glass border border-border/50 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30 bg-transparent"
              >
                {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
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
              placeholder="React, TypeScript, GitHub, Automation"
              className="w-full h-11 px-4 glass border border-border/50 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-foreground-tertiary"
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Urgency</label>
            <div className="flex gap-2">
              {([
                { value: 'low', label: 'Flexible', icon: <Clock className="w-3.5 h-3.5" />, color: 'emerald' },
                { value: 'medium', label: 'Normal', icon: <Zap className="w-3.5 h-3.5" />, color: 'amber' },
                { value: 'high', label: 'Urgent', icon: <Flame className="w-3.5 h-3.5" />, color: 'red' },
              ] as const).map(({ value, label, icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUrgency(value)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium border transition-all btn-press',
                    urgency === value
                      ? color === 'emerald'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : color === 'amber'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-secondary/30 text-foreground-tertiary border-border/30 hover:bg-secondary/50'
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
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
                Post Craving
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
