import { useState, useEffect } from 'react';
import { Save, X, Edit2, Sparkles, AlertCircle } from 'lucide-react';
import type { Skill, AnalysisResult, SkillCategory } from '../../types/skill-creator';
import { getCandyIcon } from '../illustrations';
import { getCandyColor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';

const INPUT_CLS =
  'w-full h-10 px-3 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring transition-colors';
const INPUT_ERR =
  'w-full h-10 px-3 bg-input border border-error rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-error/40 transition-colors';
const READONLY_CLS = 'px-3 py-2 bg-secondary rounded-xl border border-border text-sm text-foreground';

interface SkillPreviewEditorProps {
  skill: Partial<Skill>;
  analysisContext: AnalysisResult;
  onSave: (updatedSkill: Partial<Skill>) => Promise<void>;
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

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  Knowledge: 'Knowledge',
  Analysis: 'Analysis',
  Development: 'Development',
  Design: 'Design',
  Marketing: 'Marketing',
  Productivity: 'Productivity',
  Tools: 'Tools',
  Research: 'Research',
  Mobile: 'Mobile',
  Writing: 'Writing',
  Custom: 'Custom',
};

export function SkillPreviewEditor({
  skill: initialSkill,
  analysisContext,
  onSave,
  onCancel,
}: SkillPreviewEditorProps) {
  const isDark = useIsDark();
  const [skill, setSkill] = useState(initialSkill);
  const [originalSkill] = useState(initialSkill);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    validateSkill(skill);
  }, [skill]);

  const validateSkill = (s: Partial<Skill>) => {
    const newErrors: Record<string, string> = {};

    if (!s.name || s.name.trim().length === 0) {
      newErrors.name = 'Skill name cannot be empty';
    } else if (s.name.length > 50) {
      newErrors.name = 'Skill name cannot exceed 50 characters';
    }

    if (!s.description || s.description.trim().length === 0) {
      newErrors.description = 'Skill description cannot be empty';
    } else if (s.description.length > 500) {
      newErrors.description = 'Skill description cannot exceed 500 characters';
    }

    if (!s.category) {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
  };

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(skill);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSkill(originalSkill);
    setIsEditing(false);
    onCancel();
  };

  const hasChanges = JSON.stringify(skill) !== JSON.stringify(originalSkill);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-candy text-2xl font-bold text-foreground">Skill preview</h2>
            <p className="text-sm text-foreground-secondary">
              {isEditing ? 'Edit your skill configuration' : 'Review the generated skill'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-foreground bg-card border border-border rounded-2xl hover:border-border-hover hover:shadow-candy-1 transition-all shrink-0"
        >
          <Edit2 className="w-4 h-4" />
          {isEditing ? 'Preview mode' : 'Edit mode'}
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-card rounded-3xl border border-border shadow-candy-1 overflow-hidden">
        {/* Skill Card Preview */}
        <div className="p-6 bg-secondary border-b border-border">
          <div className="max-w-md mx-auto">
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {/* Top Bar */}
              <div className="h-10 px-4 border-b border-border flex items-center relative">
                <div className="flex items-center gap-1.5 absolute left-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]"></div>
                </div>
                <div className="mx-auto text-xs font-mono text-foreground-tertiary font-medium">
                  {skill.id || 'new-skill'}.ts
                </div>
              </div>

              {/* Content */}
              <div className="p-5 font-mono text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-syntax-keyword font-bold">export</span>
                  <span className="text-syntax-function font-bold">
                    {skill.name?.replace(/\s+/g, '') || 'NewSkill'}
                  </span>
                </div>
                <div className="text-foreground-tertiary italic text-xs leading-5 border-l-2 border-border pl-3 py-1 mt-3">
                  /** <br />
                  &nbsp;* {skill.description || 'Skill description'} <br />
                  &nbsp;*/
                </div>
              </div>

              {/* Footer */}
              <div className="h-10 px-4 border-t border-border bg-secondary flex items-center justify-between text-xs font-mono text-foreground-tertiary">
                <span>{CATEGORY_LABELS[skill.category as SkillCategory] || 'Category'}</span>
                {(() => {
                  const Candy = getCandyIcon(skill.category, isDark);
                  return <Candy size={18} color={getCandyColor(skill.category, isDark)} />;
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">Skill name *</label>
            {isEditing ? (
              <input
                type="text"
                value={skill.name || ''}
                onChange={(e) => setSkill({ ...skill, name: e.target.value })}
                className={errors.name ? INPUT_ERR : INPUT_CLS}
                placeholder="e.g., Data Analysis Expert"
              />
            ) : (
              <div className={READONLY_CLS}>
                {skill.name || 'Not set'}
              </div>
            )}
            {errors.name && (
              <p className="mt-1.5 text-xs text-error flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Skill description *
            </label>
            {isEditing ? (
              <textarea
                value={skill.description || ''}
                onChange={(e) => setSkill({ ...skill, description: e.target.value })}
                rows={4}
                className={`${errors.description ? INPUT_ERR : INPUT_CLS} h-auto py-2.5 resize-none`}
                placeholder="Describe what this skill can do…"
              />
            ) : (
              <div className={`${READONLY_CLS} whitespace-pre-wrap`}>
                {skill.description || 'Not set'}
              </div>
            )}
            {errors.description && (
              <p className="mt-1.5 text-xs text-error flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">Category *</label>
            {isEditing ? (
              <select
                value={skill.category || ''}
                onChange={(e) => setSkill({ ...skill, category: e.target.value as SkillCategory })}
                className={errors.category ? INPUT_ERR : INPUT_CLS}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            ) : (
              <div className={READONLY_CLS}>
                {skill.category ? CATEGORY_LABELS[skill.category as SkillCategory] : 'Not set'}
              </div>
            )}
            {errors.category && (
              <p className="mt-1.5 text-xs text-error flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.category}
              </p>
            )}
          </div>

          {/* Analysis Context */}
          <div className="bg-secondary rounded-xl p-4 border border-border">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">
              AI analysis
            </p>
            <div className="space-y-2 text-xs text-foreground-secondary">
              <div>
                <span className="font-medium text-foreground">Work domain:</span>{' '}
                {analysisContext.workDomain.join(', ') || '—'}
              </div>
              <div>
                <span className="font-medium text-foreground">Technical skills:</span>{' '}
                {analysisContext.technicalSkills.join(', ') || '—'}
              </div>
              <div>
                <span className="font-medium text-foreground">Confidence:</span>{' '}
                <span className="font-mono">{(analysisContext.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleCancel}
          className="inline-flex items-center h-10 px-5 text-sm font-semibold text-foreground bg-card border border-border rounded-2xl hover:border-border-hover hover:shadow-candy-1 transition-all"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || Object.keys(errors).length > 0 || !hasChanges}
          className="candy-btn btn-press inline-flex items-center h-10 px-5 text-sm font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save skill
            </>
          )}
        </button>
      </div>
    </div>
  );
}
