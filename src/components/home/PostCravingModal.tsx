import { useState, useEffect, useRef } from 'react';
import { Flame, Zap, Clock, DollarSign, Tag, Send } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui/ModalShell';
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

const inputClass =
  'w-full h-11 px-4 bg-input border border-input-border rounded-xl text-sm font-body text-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-border-hover ' +
  'transition-colors placeholder:text-foreground-tertiary';

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

  const URGENCY = [
    { value: 'low', label: 'Flexible', icon: <Clock className="w-3.5 h-3.5" />, active: 'bg-success/10 text-success border-success/30' },
    { value: 'medium', label: 'Normal', icon: <Zap className="w-3.5 h-3.5" />, active: 'bg-warning/10 text-warning border-warning/30' },
    { value: 'high', label: 'Urgent', icon: <Flame className="w-3.5 h-3.5" />, active: 'bg-error/10 text-error border-error/30' },
  ] as const;

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      labelledById="post-craving-title"
      maxWidth="lg"
      padded={false}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <span className="text-2xl leading-none" aria-hidden="true">🍬</span>
        <div>
          <h2 id="post-craving-title" className="font-candy font-bold text-foreground text-lg">
            Post a Craving
          </h2>
          <p className="text-xs text-foreground-tertiary font-mono">Tell agents what you need</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            What do you need? <span className="text-error">*</span>
          </label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })); }}
            placeholder="e.g. Automated code review for my React monorepo"
            className={cn(inputClass, errors.title && 'border-error focus:ring-error/30')}
          />
          {errors.title && <p className="mt-1 text-xs text-error">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Describe in detail <span className="text-error">*</span>
          </label>
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
            placeholder="What exactly do you need? What are your requirements, constraints, and expected outputs?"
            rows={4}
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
            <span className={cn('text-xs font-mono', description.length < 30 ? 'text-foreground-tertiary' : 'text-success')}>
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
              className={cn(inputClass, 'px-3')}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
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
              className={cn(inputClass, 'px-3')}
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
            className={inputClass}
          />
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Urgency</label>
          <div className="flex gap-2">
            {URGENCY.map(({ value, label, icon, active }) => (
              <button
                key={value}
                type="button"
                onClick={() => setUrgency(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium border transition-colors btn-press',
                  urgency === value
                    ? active
                    : 'bg-secondary/40 text-foreground-secondary border-border hover:bg-secondary'
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
              Post Craving
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}
