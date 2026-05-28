import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Skill, SkillCategory } from '../../types/skill-creator';
import { CreatorHeader } from './CreatorHeader';
import { getCandyEmoji } from '../../utils/candy';
import { getFlavor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';

const INPUT_CLS =
  'w-full h-10 px-3 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring transition-colors';
const INPUT_ERR =
  'w-full h-10 px-3 bg-input border border-error rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-error/40 transition-colors';

interface ManualSkillFormProps {
  onSave: (skill: Partial<Skill>) => void;
  onCancel: () => void;
}

const CATEGORIES: SkillCategory[] = [
  'Knowledge',
  'Tools',
  'Productivity',
  'Development',
  'Analysis',
  'Custom',
];

export function ManualSkillForm({ onSave, onCancel }: ManualSkillFormProps) {
  const isDark = useIsDark();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('Custom');
  // The card glyph is derived from the category candy illustration (no emoji
  // picker — DESIGN.md §0). `icon` stays as a neutral data field for storage.
  const icon = 'candy';
  const [systemPrompt, setSystemPrompt] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Skill name is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    }
    if (capabilities.length === 0) {
      newErrors.capabilities = 'At least one capability is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddCapability = () => {
    if (newCapability.trim() && !capabilities.includes(newCapability.trim())) {
      setCapabilities([...capabilities, newCapability.trim()]);
      setNewCapability('');
    }
  };

  const handleRemoveCapability = (index: number) => {
    setCapabilities(capabilities.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const skill: Partial<Skill> = {
      id: `skill-${Date.now()}`,
      name,
      description,
      category,
      icon,
      color: 'bg-primary/10 border-primary/20 text-primary',
      tags: [category],
      config: {
        capabilities,
        systemPrompt,
        parameters: {},
      },
      sourceFiles: [],
      analysisContext: {
        workDomain: [],
        technicalSkills: [],
        experiencePatterns: [],
        keyTopics: [],
        suggestedName: name,
        suggestedDescription: description,
        suggestedCategory: category,
        suggestedCapabilities: capabilities,
        filesSummary: [],
        confidence: 100,
        systemPrompt,
      },
      installCommand: `skill install ${name.toLowerCase().replace(/\s+/g, '-')}`,
      popularity: 0,
      status: 'draft',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSave(skill);
  };

  return (
    <div className="space-y-6">
      <CreatorHeader
        eyebrow="hand-made"
        title="Create a skill manually"
        subtitle="Hand-craft every detail of your new candy."
        onBack={onCancel}
      />

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card rounded-3xl shadow-candy-1 border border-border p-6 md:p-8 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">Skill name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Code Reviewer, Data Analyzer"
            className={errors.name ? INPUT_ERR : INPUT_CLS}
          />
          {errors.name && <p className="text-sm text-error mt-1.5">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this skill does…"
            rows={3}
            className={`${errors.description ? INPUT_ERR : INPUT_CLS} h-auto py-2.5 resize-none`}
          />
          {errors.description && <p className="text-sm text-error mt-1.5">{errors.description}</p>}
        </div>

        {/* Category — with a live candy preview (the card glyph derives from it) */}
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">Category</label>
          <div className="flex items-center gap-3">
            {(() => {
              const f = getFlavor(category, isDark);
              return (
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-xl text-2xl leading-none shrink-0"
                  style={{ background: f.tint }}
                  aria-hidden="true"
                  title="Your candy"
                >
                  {getCandyEmoji(category)}
                </div>
              );
            })()}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory)}
              className={`${INPUT_CLS} flex-1`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">System prompt *</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Define how this skill should behave and respond…"
            rows={4}
            className={`${errors.systemPrompt ? INPUT_ERR : INPUT_CLS} h-auto py-2.5 resize-none`}
          />
          {errors.systemPrompt && (
            <p className="text-sm text-error mt-1.5">{errors.systemPrompt}</p>
          )}
        </div>

        {/* Capabilities */}
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Capabilities *{' '}
            {capabilities.length > 0 && (
              <span className="text-foreground-tertiary font-mono">({capabilities.length})</span>
            )}
          </label>

          {/* Add capability input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newCapability}
              onChange={(e) => setNewCapability(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCapability();
                }
              }}
              placeholder="Enter a capability and press Enter"
              className={`${INPUT_CLS} flex-1`}
            />
            <button
              type="button"
              onClick={handleAddCapability}
              className="candy-btn btn-press h-10 px-4 rounded-xl font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Capabilities list */}
          {capabilities.length > 0 && (
            <div className="space-y-2">
              {capabilities.map((cap, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-secondary p-3 rounded-xl border border-border"
                >
                  <span className="text-sm text-foreground">{cap}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCapability(index)}
                    className="text-foreground-tertiary hover:text-error transition-colors"
                    aria-label={`Remove ${cap}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.capabilities && (
            <p className="text-sm text-error mt-1.5">{errors.capabilities}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 px-5 rounded-2xl border border-border bg-card text-foreground font-semibold hover:border-border-hover hover:shadow-candy-1 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="candy-btn btn-press flex-1 h-10 px-5 rounded-2xl font-semibold"
          >
            Create skill
          </button>
        </div>
      </form>
    </div>
  );
}
